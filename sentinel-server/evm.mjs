import { abiText, clean, fetchJson, hexWord, object, rpc, uint, units } from "./upstreams.mjs";

const sourcify = "Sourcify";
const goPlus = "GoPlus Security";
const addressWord = value => hexWord(value) && /^0x0{24}/i.test(value) ? "0x" + value.slice(-40).toLowerCase() : null;
const zero = "0x" + "0".repeat(40);
const slots = [
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
  "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3", // ZeppelinOS implementation
  "0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b" // ZeppelinOS admin
];
const selectors = ["0x06fdde03", "0x95d89b41", "0x313ce567", "0x18160ddd", "0x8da5cb5b", "0x5c975abb"];
const namedChecks = {
  mint: /^(mint|mintTo|mintFor|issue|increaseSupply)$/i,
  pause: /^(pause|unpause|setPaused)$/i,
  deny: /^(blacklist|addBlacklist|addBlackList|setBlacklist|setBlacklisted|blockAddress)$/i,
  allow: /^(setWhitelist|setWhitelisted|enableWhitelist)$/i,
  transfer: /^(enableTrading|openTrading|setTradingEnabled|setTransferEnabled|setTransferRestrictions)$/i,
  limits: /^(setMaxTxAmount|setMaxTransactionAmount|setMaxWallet|setMaxWalletAmount)$/i,
  feeControl: /^(setTax|setFees|setBuyTax|setSellTax|setTransferFee|updateFees)$/i,
  methods: /^(upgradeTo|upgradeToAndCall|setImplementation|changeAdmin|setMinter|grantRole|setOperator|setController|rescueTokens)$/i
};

export const fact = (status, source, detail, priority = 0) => ({ status, source, detail, priority });
export const unknown = (source, detail) => fact("UNKNOWN", source, detail);
export const severityFor = (value, warning, high) => value >= high ? "HIGH RISK" : value >= warning ? "WARNING" : "PASS";
export function mergeFact(evidence, key, candidate) {
  const prior = evidence[key];
  if (!prior || candidate.priority > prior.priority || prior.status === "UNKNOWN") evidence[key] = candidate;
}

export async function inspectEvmRpc(fetcher, config, address) {
  const rpcSource = config.rpcLabel ?? "PublicNode EVM RPC";
  const [chain, block] = await rpc(fetcher, config.rpc, [["eth_chainId", []], ["eth_blockNumber", []]]);
  if (typeof chain !== "string" || !/^0x[0-9a-f]+$/i.test(chain) || BigInt(chain) !== BigInt(config.chain) ||
      typeof block !== "string" || !/^0x[0-9a-f]{1,16}$/i.test(block)) throw new Error("Unconfirmed chain or block");
  const reads = [
    ["eth_getCode", [address, block]],
    ...slots.map(slot => ["eth_getStorageAt", [address, slot, block]]),
    ...selectors.map(data => ["eth_call", [{ to: address, data, gas: "0x493e0" }, block]])
  ];
  const batches = [];
  const size = config.batchSize ?? reads.length;
  for (let offset = 0; offset < reads.length; offset += size) batches.push(reads.slice(offset, offset + size));
  const [code, implementation, admin, beacon, legacyImpl, legacyAdmin, name, symbol, decimals, supply, owner, paused] =
    (await Promise.all(batches.map(batch => rpc(fetcher, config.rpc, batch)))).flat();
  if (typeof code !== "string" || !/^0x(?:[0-9a-f]{2})*$/i.test(code)) throw new Error("Invalid contract bytecode");
  if (code === "0x") return { confirmed: false, block, detail: "No deployed contract code at the observed block." };
  const evidence = {};
  const holder = addressWord(owner);
  const adminAddress = addressWord(admin);
  const implementationAddress = addressWord(implementation);
  const beaconAddress = addressWord(beacon);
  const legacyTarget = addressWord(legacyImpl);
  const legacyOwner = addressWord(legacyAdmin);
  const minimal = code.match(/^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/i);
  const target = implementationAddress && implementationAddress !== zero ? implementationAddress : null;
  const beaconTarget = beaconAddress && beaconAddress !== zero ? beaconAddress : null;
  const legacy = legacyTarget && legacyTarget !== zero && legacyOwner && legacyOwner !== zero;
  if (target || beaconTarget || minimal || legacy || (adminAddress && adminAddress !== zero)) {
    const detail = [
      target && "EIP-1967 implementation " + target,
      beaconTarget && "EIP-1967 beacon " + beaconTarget,
      adminAddress && adminAddress !== zero && "EIP-1967 admin " + adminAddress,
      legacy && "ZeppelinOS implementation " + legacyTarget + " and admin " + legacyOwner,
      minimal && "EIP-1167 fixed implementation 0x" + minimal[1]
    ].filter(Boolean).join("; ");
    const fixedClone = minimal && !target && !beaconTarget && !legacy && (!adminAddress || adminAddress === zero);
    evidence.proxy = fact(fixedClone ? "PASS" : "WARNING", rpcSource, detail +
      (fixedClone ? ". This standard clone fixes its immediate target; the target can have its own controls." : "."), fixedClone ? 1 : 3);
  } else {
    evidence.proxy = unknown(rpcSource, "No supported EIP-1967, EIP-1167 or ZeppelinOS indicator was confirmed; other proxy patterns may exist.");
  }
  evidence.owner = holder ? fact(holder === zero ? "PASS" : "WARNING", rpcSource,
    holder === zero ? "owner() returned the zero address at block " + block + "." : "owner() returned " + holder + " at block " + block + ".",
    holder === zero ? 1 : 3) : unknown(rpcSource, "owner() did not return a readable address.");
  const pausedValue = uint(paused);
  if (pausedValue === 0n || pausedValue === 1n) {
    evidence.pause = pausedValue === 1n ? fact("HIGH RISK", rpcSource, "paused() returned true.", 4)
      : unknown(rpcSource, "paused() returned false. The authority to pause was not established.");
  }
  const decimalWord = uint(decimals);
  return {
    confirmed: true, block, target: target ?? (legacy ? legacyTarget : minimal ? "0x" + minimal[1].toLowerCase() : null), evidence,
    name: abiText(name), symbol: abiText(symbol),
    supply: units(uint(supply), decimalWord === null ? null : Number(decimalWord))
  };
}

async function verifiedContract(fetcher, chain, address) {
  const data = await fetchJson(fetcher, "https://sourcify.dev/server/v2/contract/" + chain + "/" + address + "?fields=abi");
  if (data === null) return null;
  if (!object(data) || !["exact_match", "match"].includes(data.match) || !Array.isArray(data.abi)) {
    throw new Error("Unexpected source verification response");
  }
  return data;
}

export async function inspectVerification(fetcher, chain, address, target) {
  const contracts = await Promise.allSettled([address, ...(target && target !== address ? [target] : [])]
    .map(location => verifiedContract(fetcher, chain, location)));
  const [main, implementation] = contracts;
  const evidence = {
    verification: main.status === "fulfilled" && main.value
      ? fact("PASS", sourcify, "Submitted contract: " + main.value.match.replace("_", " ") +
          (implementation?.value ? ". Implementation: " + implementation.value.match.replace("_", " ") : "") + ".")
      : unknown(sourcify, main.status === "rejected" ? "Verification lookup failed." :
        "No Sourcify match for the submitted contract." +
        (implementation?.value ? " The detected implementation has a Sourcify match." : " Other registries may contain a match."))
  };
  const abi = target && target !== address ? implementation?.value?.abi : main.value?.abi;
  for (const [key, pattern] of Object.entries(namedChecks)) {
    const names = Array.isArray(abi) ? [...new Set(abi.slice(0, 1500).filter(entry =>
      entry?.type === "function" && typeof entry.name === "string" && pattern.test(entry.name)
    ).map(entry => entry.name))].slice(0, 6) : [];
    if (names.length) evidence[key] = fact("WARNING", sourcify,
      "Published " + (target ? "implementation " : "") + "ABI exposes " + names.join(", ") + ". Access controls were not established.", 2);
  }
  return { evidence, available: contracts.some(item => item.status === "fulfilled"),
    partial: contracts.some(item => item.status === "rejected"), matched: Boolean(main.value) };
}

export function ratio(value) {
  if ((typeof value !== "number" && typeof value !== "string") ||
      !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value))) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number * 100 : null;
}
const percent = value => value.toFixed(2) + "%";
const yes = (data, key) => data[key] === "1" || data[key] === 1;
const no = (data, key) => data[key] === "0" || data[key] === 0;
const flagged = (data, fields, severe = false) => {
  const active = fields.filter(([key]) => yes(data, key)).map(([, label]) => label);
  if (active.length) return fact(severe ? "HIGH RISK" : "WARNING", goPlus, "Provider reports " + active.join(", ") + ".", severe ? 4 : 3);
  if (fields.every(([key]) => no(data, key))) return fact("PASS", goPlus,
    "Provider did not flag " + fields.map(([, label]) => label).join(", ") + " in its checks.", 1);
  return unknown(goPlus, "Provider did not supply a complete result for this check.");
};
const getRows = value => Array.isArray(value) ? value.slice(0, 100).flatMap(row => {
  const address = clean(row?.address, 42);
  const percentage = ratio(row?.percent);
  return address && /^0x[0-9a-f]{40}$/i.test(address) && percentage !== null
    ? [{ address, percentage, locked: row.is_locked === 1 || row.is_locked === "1" ? true :
      row.is_locked === 0 || row.is_locked === "0" ? false : null }] : [];
}).sort((a, b) => b.percentage - a.percentage) : [];

export async function inspectGoPlus(fetcher, chain, address, bearer) {
  const reply = await fetchJson(fetcher, "https://api.gopluslabs.io/api/v1/token_security/" + chain +
    "?contract_addresses=" + address, bearer ? { headers: { authorization: "Bearer " + bearer } } : {});
  if (!object(reply) || reply.code !== 1 || !object(reply.result)) throw new Error("Invalid token security response");
  const data = reply.result[address];
  if (!object(data) || !Object.keys(data).length) return { available: true, matched: false };
  const evidence = {
    mint: flagged(data, [["is_mintable", "mint capability"]]),
    pause: flagged(data, [["transfer_pausable", "transfer pause capability"]]),
    deny: flagged(data, [["is_blacklisted", "blacklist logic"]]),
    allow: flagged(data, [["is_whitelisted", "whitelist logic"]]),
    transfer: flagged(data, [["trading_cooldown", "trading cooldown"]]),
    limits: flagged(data, [["is_anti_whale", "anti-whale limits"]]),
    feeControl: flagged(data, [["slippage_modifiable", "modifiable taxes"], ["personal_slippage_modifiable", "account-specific modifiable taxes"]]),
    honeypot: flagged(data, [["is_honeypot", "honeypot behavior"], ["cannot_sell_all", "inability to sell all"],
      ["cannot_buy", "inability to buy"]], true)
  };
  const buy = ratio(data.buy_tax);
  const sell = ratio(data.sell_tax);
  const taxes = "Buy " + (buy === null ? "unknown" : percent(buy)) + "; sell " + (sell === null ? "unknown" : percent(sell)) + ".";
  const taxSeverity = severityFor(Math.max(buy ?? 0, sell ?? 0), 5, 20);
  evidence.tax = taxSeverity !== "PASS" || (buy !== null && sell !== null)
    ? fact(taxSeverity, goPlus, taxes + " Provider-reported estimates.")
    : unknown(goPlus, taxes + " Provider did not confirm both sides.");
  const transferTax = ratio(data.transfer_tax);
  if (transferTax !== null) evidence.transferFee = fact(severityFor(transferTax, Number.MIN_VALUE, 20), goPlus,
    "Provider reports a non-DEX transfer tax of " + percent(transferTax) + ".");
  if (yes(data, "is_proxy")) evidence.proxy = fact("WARNING", goPlus, "Provider identifies a proxy; implementation or upgrade permissions may be unverified.", 2);
  const holderRows = getRows(data.holders);
  const lpRows = getRows(data.lp_holders);
  if (holderRows.length) {
    const top = holderRows[0];
    evidence.holders = fact(severityFor(top.percentage, 20, 50), goPlus,
      "Largest returned address holds " + percent(top.percentage) + " of reported supply. Address roles were not independently classified.");
  }
  const unlocked = lpRows.find(row => row.locked === false);
  if (unlocked && unlocked.percentage >= 50) evidence.lp = fact("WARNING", goPlus,
    "Largest reported unlocked LP address holds " + percent(unlocked.percentage) + " of its reported LP supply.");
  else if (lpRows.length) evidence.lp = unknown(goPlus, "LP balances were reported; withdrawal control and lock coverage were not established.");
  const creator = ratio(data.creator_percent);
  if (creator !== null) evidence.creator = fact(severityFor(creator, 10, 25), goPlus,
    "Provider attributes " + percent(creator) + " of supply to the creator" +
    (clean(data.creator_address, 42) ? " (" + clean(data.creator_address, 42) + ")" : "") + ".");
  return { available: true, matched: true, evidence, holders: holderRows.slice(0, 10), lp: lpRows.slice(0, 5),
    name: clean(data.token_name), symbol: clean(data.token_symbol), buy, sell };
}
