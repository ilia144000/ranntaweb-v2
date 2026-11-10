import { clean, decimalAmount, fetchJson, normalizeInput, object, rpc, units } from "./upstreams.mjs";
import { fact, ratio, severityFor, unknown } from "./evm.mjs";

const source = "PublicNode Solana RPC";
const indexSource = "GoPlus Solana Security";
const splToken = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const token2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const publicKey = value => normalizeInput({ network: "solana", address: value })?.address ?? null;
const auth = (container, key, label, detail = "") => {
  if (container?.[key] === null) return fact("PASS", source, label + " is disabled in the parsed mint state.");
  const address = publicKey(container?.[key]);
  return address ? fact("WARNING", source, label + " " + address + "." + detail) :
    unknown(source, "The mint response did not establish the " + label.toLowerCase() + ".");
};

export async function inspectSolanaRpc(fetcher, endpoint, address) {
  const [account] = await rpc(fetcher, endpoint, [["getAccountInfo", [address, {
    encoding: "jsonParsed", commitment: "finalized"
  }]]], false);
  if (!object(account) || !Number.isSafeInteger(account.context?.slot) || !Object.hasOwn(account, "value")) {
    throw new Error("Invalid mint account response");
  }
  const program = account.value?.owner;
  const block = String(account.context.slot);
  if (account.value === null || ![splToken, token2022].includes(program)) {
    return { confirmed: false, block, detail: "The address is not an SPL Token or Token-2022 mint at the observed finalized slot." };
  }
  const parsed = account.value?.data?.parsed;
  if (!object(parsed)) throw new Error("Mint program state could not be parsed");
  if (parsed.type !== "mint") return { confirmed: false, block, detail: "The address is an SPL account, rather than a mint." };
  const info = parsed.info;
  const supply = decimalAmount(info?.supply);
  if (!object(info) || supply === null || units(supply, info.decimals) === null || info.isInitialized !== true) {
    throw new Error("Incomplete mint state");
  }
  const modern = program === token2022;
  const hasExtensions = Array.isArray(info.extensions) && info.extensions.every(entry =>
    typeof entry?.extension === "string");
  const ext = name => hasExtensions ? info.extensions.find(item => item.extension === name) : null;
  const noExtension = name => !modern ? fact("NOT APPLICABLE", source, "Legacy SPL Token program.") :
    hasExtensions ? fact("PASS", source, "No " + name + " extension in the parsed mint.") :
      unknown(source, "Token-2022 extension state was not fully parsed.");
  const evidence = {
    program: fact("PASS", source, (modern ? "Token-2022" : "SPL Token") + " · " + program + " · finalized slot " + block + "."),
    mint: auth(info, "mintAuthority", "Mint authority"),
    deny: auth(info, "freezeAuthority", "Freeze authority"),
    extensions: !modern ? fact("NOT APPLICABLE", source, "Legacy SPL Token program.") :
      hasExtensions ? fact("PASS", source, "Parsed extensions: " +
        (info.extensions.slice(0, 30).map(item => clean(item.extension, 44)).filter(Boolean).join(", ") || "none") + ".") :
        unknown(source, "Token-2022 extension state was not fully parsed."),
    delegate: noExtension("permanent delegate"),
    hook: noExtension("transfer hook"),
    transferFee: noExtension("transfer fee"),
    feeControl: noExtension("transfer fee"),
    transfer: noExtension("transfer restriction"),
    metadata: unknown(source, "Metaplex and external metadata authority were not resolved.")
  };
  const delegate = ext("permanentDelegate");
  if (delegate) evidence.delegate = auth(delegate.state, "delegate", "Permanent delegate");
  const hook = ext("transferHook");
  if (hook) evidence.hook = auth(hook.state, "programId", "Transfer hook program");
  const fee = ext("transferFeeConfig")?.state;
  if (ext("transferFeeConfig")) {
    const bps = [fee?.olderTransferFee?.transferFeeBasisPoints, fee?.newerTransferFee?.transferFeeBasisPoints]
      .filter(number => Number.isInteger(number) && number >= 0 && number <= 10000);
    evidence.transferFee = bps.length === 2 ? fact(severityFor(Math.max(...bps), 1, 2000), source,
      "Older and newer schedules specify " + bps.join(" / ") + " bps. The active schedule depends on the current epoch and the fee cap.") :
      unknown(source, "Transfer-fee extension exists, but a complete schedule was unavailable.");
    evidence.feeControl = auth(fee, "transferFeeConfigAuthority", "Transfer-fee configuration authority");
  }
  if (ext("nonTransferable")) evidence.transfer = fact("HIGH RISK", source, "The non-transferable extension is enabled.");
  else if (ext("defaultAccountState")?.state?.accountState === "frozen") {
    evidence.transfer = fact("WARNING", source, "New token accounts are frozen by default.");
  } else if (ext("defaultAccountState") || ext("pausable")) {
    evidence.transfer = unknown(source, "An account-state or pausable extension is present; restrictions were not fully evaluated.");
  }
  const meta = ext("tokenMetadata")?.state;
  if (object(meta)) evidence.metadata = auth(meta, "updateAuthority", "On-mint metadata update authority",
    " External metadata is outside this check.");
  return { confirmed: true, block, supplyRaw: supply, supply: units(supply, info.decimals),
    name: clean(meta?.name), symbol: clean(meta?.symbol), evidence };
}

export async function inspectSolanaHolders(fetcher, endpoint, address) {
  const [data] = await rpc(fetcher, endpoint, [["getTokenLargestAccounts", [address, { commitment: "finalized" }]]], false);
  if (!Array.isArray(data?.value) || !Number.isSafeInteger(data.context?.slot)) throw new Error("Invalid holder response");
  return { slot: data.context.slot, rows: data.value.slice(0, 20).flatMap(row => {
    const key = publicKey(row?.address);
    const amount = decimalAmount(row?.amount);
    return key && amount !== null ? [{ address: key, amount }] : [];
  }) };
}

export function solanaConcentration(holders, mint) {
  if (!mint?.confirmed || mint.supplyRaw === 0n || !holders.rows.length) return null;
  if (holders.slot !== Number(mint.block)) return {
    rows: [],
    finding: unknown(source, "Largest accounts and mint supply came from different finalized slots (" +
      holders.slot + " and " + mint.block + "); a comparable percentage was unavailable.")
  };
  const rows = holders.rows.filter(row => row.amount <= mint.supplyRaw).map(row => ({
    address: row.address, percentage: Number(row.amount * 1000000n / mint.supplyRaw) / 10000
  })).sort((a, b) => b.percentage - a.percentage).slice(0, 10);
  if (!rows.length) return null;
  return { rows, finding: fact(severityFor(rows[0].percentage, 20, 50), source,
    "Largest returned token account holds " + rows[0].percentage.toFixed(2) + "% at finalized slot " + holders.slot +
    ". Token accounts can belong to pools, programs or the same wallet.") };
}

export async function inspectSolanaIndex(fetcher, address, bearer, mint) {
  const response = await fetchJson(fetcher, "https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=" + address,
    bearer ? { headers: { authorization: "Bearer " + bearer } } : {});
  if (!object(response) || response.code !== 1 || !object(response.result)) throw new Error("Invalid Solana token index response");
  const data = response.result[address];
  if (!object(data)) return { matched: false };
  const indexed = Array.isArray(data.holders) ? data.holders.slice(0, 20).flatMap(item => {
    const owner = publicKey(item?.account);
    const percentage = ratio(item?.percent);
    if (!owner || percentage === null) return [];
    const accounts = typeof item.token_account === "string" ? item.token_account.slice(0, 12000).split(",", 40)
      .map(publicKey).filter(Boolean) : [];
    return [{ address: owner, percentage, accounts }];
  }).sort((a, b) => b.percentage - a.percentage).slice(0, 10) : [];
  const holders = indexed.map(({ address, percentage }) => ({ address, percentage }));
  const indexSupply = Number(data.total_supply);
  const chainSupply = Number(mint?.supply);
  const comparable = Number.isFinite(indexSupply) && Number.isFinite(chainSupply) && chainSupply > 0 &&
    Math.abs(indexSupply - chainSupply) / chainSupply <= 0.05;
  const evidence = {};
  if (holders.length) evidence.holders = comparable
    ? fact(severityFor(holders[0].percentage, 20, 50), indexSource,
      "Largest indexed address holds " + holders[0].percentage.toFixed(2) + "% of provider-reported supply. The index has no verified snapshot time.")
    : unknown(indexSource, "Indexed holder percentages are shown as reference. The index did not supply a total within 5% of positive on-chain supply, so they are unscored.");
  const authorities = Array.isArray(data.metadata_mutable?.metadata_upgrade_authority) ?
    data.metadata_mutable.metadata_upgrade_authority.slice(0, 8).map(item => publicKey(item?.address)).filter(Boolean) : [];
  if (authorities.length && data.metadata_mutable.status === "1") evidence.metadata = fact("WARNING", indexSource,
    "Provider identifies metadata update authority " + authorities.join(", ") + ". Independent RPC verification was unavailable.");
  return { matched: true, holders, indexed, evidence, name: clean(data.metadata?.name), symbol: clean(data.metadata?.symbol) };
}

export async function recheckIndexedAccounts(fetcher, endpoint, mintAddress, index) {
  const candidates = new Map();
  // PublicNode permits ten keys per call, including the mint for the denominator.
  const accountLimit = 9;
  const depth = Math.max(0, ...index.indexed.map(holder => holder.accounts.length));
  for (let offset = 0; offset < depth && candidates.size < accountLimit; offset++) {
    for (const holder of index.indexed) {
      const address = holder.accounts[offset];
      if (address && address !== mintAddress && !candidates.has(address)) candidates.set(address, holder.address);
      if (candidates.size === accountLimit) break;
    }
  }
  const keys = [mintAddress, ...candidates.keys()];
  const [batch] = await rpc(fetcher, endpoint, [["getMultipleAccounts", [keys, {
    encoding: "jsonParsed", commitment: "finalized"
  }]]], false);
  if (!Array.isArray(batch?.value) || batch.value.length !== keys.length || !Number.isSafeInteger(batch.context?.slot)) {
    throw new Error("Invalid account recheck response");
  }
  const [mint, ...accounts] = batch.value;
  const supply = decimalAmount(mint?.data?.parsed?.info?.supply);
  if (![splToken, token2022].includes(mint?.owner) || mint.data?.parsed?.type !== "mint" || !supply) {
    return { matched: false };
  }
  const balances = new Map();
  for (const [index, account] of accounts.entries()) {
    const parsed = account?.data?.parsed;
    const info = parsed?.info;
    const owner = candidates.get(keys[index + 1]);
    const amount = decimalAmount(info?.tokenAmount?.amount);
    if (account?.owner !== mint.owner || parsed?.type !== "account" || info?.mint !== mintAddress ||
        info.owner !== owner || amount === null) continue;
    balances.set(owner, (balances.get(owner) ?? 0n) + amount);
  }
  const rows = [...balances].filter(([, amount]) => amount <= supply).map(([address, amount]) => ({
    address, percentage: Number(amount * 1000000n / supply) / 10000
  })).sort((a, b) => b.percentage - a.percentage);
  if (!rows.length) return { matched: false };
  const percentage = rows[0].percentage;
  const detail = "Largest checked owner holds at least " + percentage.toFixed(2) + "% at finalized slot " + batch.context.slot +
    ". GoPlus supplied the candidate accounts; this is a lower bound on selected balances, not a full top-holder list.";
  return { rows, evidence: { holders: percentage >= 20 ? fact(severityFor(percentage, 20, 50), source, detail, 3) :
    { ...unknown(source, detail), priority: 2 } } };
}
