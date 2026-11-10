import { clean, fetchJson, networks, normalizeInput, object } from "./upstreams.mjs";
import { fact, inspectEvmRpc, inspectGoPlus, inspectVerification, mergeFact, unknown } from "./evm.mjs";
import { inspectSolanaHolders, inspectSolanaIndex, inspectSolanaRpc, recheckIndexedAccounts, solanaConcentration } from "./solana.mjs";
import { findingsFrom, policy, score } from "./rules.mjs";

const evmChecks = ["verification", "owner", "proxy", "mint", "pause", "deny", "methods", "external",
  "honeypot", "tax", "transferFee", "feeControl", "allow", "transfer", "limits", "liquidity", "pools", "lp", "holders", "creator"];
const solanaChecks = ["program", "extensions", "mint", "deny", "delegate", "metadata", "hook", "transferFee",
  "feeControl", "transfer", "liquidity", "pools", "lp", "holders", "creator"];
const dexSource = "DEX Screener";
const dollar = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

async function inspectDex(fetcher, network, address) {
  const data = await fetchJson(fetcher, "https://api.dexscreener.com/token-pairs/v1/" + network + "/" + address);
  if (!Array.isArray(data)) throw new Error("Invalid pool response");
  const valid = new Map();
  const exact = value => typeof value === "string" &&
    (network === "solana" ? value : value.toLowerCase()) === address;
  for (const row of data.slice(0, 200)) {
    if (!object(row) || row.chainId !== network) continue;
    const token = exact(row.baseToken?.address) ? row.baseToken : exact(row.quoteToken?.address) ? row.quoteToken : null;
    const pair = normalizeInput({ network, address: row.pairAddress })?.address;
    const liquidity = row.liquidity?.usd;
    if (!token || !pair || typeof liquidity !== "number" || !Number.isFinite(liquidity) ||
        liquidity < 0 || liquidity > 1e15) continue;
    if (!valid.has(pair)) valid.set(pair, { pair, liquidity, venue: clean(row.dexId, 32) ?? "Unknown DEX", token });
  }
  const pools = [...valid.values()].sort((a, b) => b.liquidity - a.liquidity);
  if (!pools.length) return { available: true, matched: false, evidence: {
    liquidity: unknown(dexSource, "No matching pool with a reported USD liquidity value was returned.")
  } };
  const total = pools.reduce((sum, row) => sum + row.liquidity, 0);
  const concentration = total > 0 ? 100 * pools[0].liquidity / total : null;
  const evidence = {
    liquidity: fact(total < 10000 ? "HIGH RISK" : total < 100000 ? "WARNING" : "PASS", dexSource,
      dollar.format(total) + " reported across " + pools.length + " matching tracked pool(s). This is a provider snapshot."),
    pools: concentration === null ? unknown(dexSource, "Concentration cannot be calculated from zero reported liquidity.") :
      fact(concentration >= 95 ? "WARNING" : "PASS", dexSource,
        "Largest pool accounts for " + concentration.toFixed(2) + "% of the USD liquidity returned.")
  };
  return { available: true, matched: true, evidence, total, concentration, count: pools.length,
    pools: pools.slice(0, 5).map(({ pair, venue, liquidity }) => ({ pair, venue, liquidity })),
    name: clean(pools[0].token.name), symbol: clean(pools[0].token.symbol) };
}

export async function scan({ network, address }, { fetcher = fetch, bearer, now = Date.now } = {}) {
  const input = normalizeInput({ network, address });
  if (!input) throw new TypeError("Invalid scan input");
  ({ network, address } = input);
  const config = networks[network];
  const solana = network === "solana";
  const sources = [];
  const evidence = {};
  let rpcName = solana ? "PublicNode Solana RPC" : "PublicNode EVM RPC";
  const run = async (name, operation) => {
    try {
      const result = await operation();
      sources.push({ name, status: result.available === false ? "UNAVAILABLE" : result.partial ? "PARTIAL" :
        result.matched === false ? "NO MATCH" : "AVAILABLE",
        detail: result.available === false ? "The upstream lookup could not be verified." : result.detail ??
          (result.partial ? "Some upstream reads were unavailable." : null) });
      for (const [key, item] of Object.entries(result.evidence ?? {})) mergeFact(evidence, key, item);
      return result;
    } catch (error) {
      const detail = /^Upstream (?:HTTP \d{3}|provider code -?\d{1,6})$/.test(error?.message) ? error.message + "." :
        error?.name === "TimeoutError" || error?.name === "AbortError" ? "The upstream request timed out." :
        error?.name === "SyntaxError" ? "The upstream response was not valid JSON." :
        error?.name === "TypeError" ? "The upstream response could not be read." :
        "The upstream response did not contain verified scan data.";
      sources.push({ name, status: "UNAVAILABLE", detail });
      return null;
    }
  };

  const rpcTask = run(rpcName, () => solana ? inspectSolanaRpc(fetcher, config.rpc, address) :
    inspectEvmRpc(fetcher, config, address)).then(async result => {
    for (const fallback of config.fallbacks ?? []) {
      if (result) break;
      rpcName = fallback.rpcLabel;
      result = await run(rpcName, () => inspectEvmRpc(fetcher, { ...config, ...fallback }, address));
    }
    return result;
  });
  const dexTask = run(dexSource, () => inspectDex(fetcher, network, address));
  const secondaryTask = solana ? run("Solana largest token accounts",
    () => inspectSolanaHolders(fetcher, config.rpc, address)) :
    run("GoPlus Security", () => inspectGoPlus(fetcher, config.chain, address, bearer));
  const verificationTask = solana ? Promise.resolve() : rpcTask.then(chain => run("Sourcify",
    () => inspectVerification(fetcher, config.chain, address, chain?.target)));
  const [chain, dex, secondary] = await Promise.all([rpcTask, dexTask, secondaryTask, verificationTask]);

  let holders = solana ? [] : secondary?.holders ?? [];
  let holderType = solana ? "Token accounts at the finalized slot" : "GoPlus-reported holder addresses";
  if (solana && secondary) {
    const concentration = solanaConcentration(secondary, chain);
    if (concentration) {
      holders = concentration.rows;
      evidence.holders = concentration.finding;
    }
  }
  const index = solana && chain?.confirmed !== false && (!holders.length || evidence.metadata?.status === "UNKNOWN") ?
    await run("GoPlus Solana Security", () => inspectSolanaIndex(fetcher, address, bearer, chain)) : null;
  if (solana && !holders.length && index?.holders?.length) {
    holders = index.holders;
    holderType = "GoPlus indexed addresses · provider supply and unknown snapshot age";
    if (chain?.confirmed && evidence.holders?.status === "UNKNOWN" && index.indexed.some(row => row.accounts.length)) {
      const rechecked = await run("Solana account balance recheck", () => recheckIndexedAccounts(fetcher, config.rpc, address, index));
      if (rechecked?.rows?.length) {
        holders = rechecked.rows;
        holderType = "Selected owner balances · verified lower bounds at one finalized slot";
      }
    }
  }
  if (solana) {
    evidence.creator = unknown("Coverage", "Mint authority is not proof of creator identity or wallet balances.");
    evidence.lp = unknown(dexSource, "Pool ownership and lock structure require venue-specific evidence.");
  } else if (!evidence.transferFee) {
    evidence.transferFee = unknown("Coverage", "A separate transfer tax could not be established from the supported EVM sources.");
  }

  const confirmed = chain?.confirmed === true;
  const ids = solana ? solanaChecks : evmChecks;
  if (chain?.confirmed === false) {
    for (const id of ids) evidence[id] = unknown(rpcName, chain.detail);
    holders = [];
  }
  const findings = findingsFrom(evidence, ids);
  return {
    ruleVersion: policy.version, scannedAt: new Date(now()).toISOString(), network, networkLabel: config.label, address,
    assetStatus: confirmed ? "CONFIRMED" : chain?.confirmed === false ? "NOT FOUND" : "UNCONFIRMED",
    assetDetail: chain?.detail ?? (confirmed ? "On-chain identity confirmed." : "The blockchain identity could not be confirmed."),
    asset: {
      name: chain?.confirmed === false ? null : chain?.name ?? index?.name ?? secondary?.name ?? dex?.name ?? null,
      symbol: chain?.confirmed === false ? null : chain?.symbol ?? index?.symbol ?? secondary?.symbol ?? dex?.symbol ?? null,
      metadataSource: chain?.confirmed === false ? null : chain?.name || chain?.symbol ? rpcName :
        index?.name || index?.symbol ? "GoPlus Solana Security" : secondary?.name || secondary?.symbol ? "GoPlus Security" :
          dex?.name || dex?.symbol ? dexSource : null,
      supply: chain?.supply ?? null, chainPosition: chain?.block ?? null
    },
    sources: sources.sort((a, b) => a.name.localeCompare(b.name)), findings, risk: score(findings, confirmed),
    holders, holderType,
    liquidity: chain?.confirmed === false || !dex?.matched ? null : {
      usd: dex.total, poolCount: dex.count, largestPoolPercent: dex.concentration, pools: dex.pools
    },
    lpHolders: chain?.confirmed === false || solana ? [] : secondary?.lp ?? [],
    limitations: [
      "Unknown findings can change the risk assessment. A lower score only reflects the evidence available for this scan.",
      "Provider observations and on-chain reads may reflect different times. A scan is a point-in-time report.",
      solana ? "Largest token accounts are not a count of distinct beneficial owners. External metadata authority and pool locks require separate evidence." :
        "Proxy detection covers supported standards. ABI names and provider simulations do not establish all roles or execution paths."
    ]
  };
}
