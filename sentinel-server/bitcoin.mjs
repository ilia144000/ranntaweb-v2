import { fetchJson, object } from "./upstreams.mjs";

const satoshis = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const stats = value => object(value) &&
  ["tx_count", "funded_txo_count", "funded_txo_sum", "spent_txo_count", "spent_txo_sum"]
    .every(key => Number.isSafeInteger(value[key]) && value[key] >= 0) ? value : null;
const btc = sats => (sats / 100000000).toFixed(8);

const sameAddress = (left, right) => typeof left === "string" &&
  (left === right || (/^bc1/i.test(left) && /^bc1/i.test(right) && left.toLowerCase() === right.toLowerCase()));

async function mempoolScan(fetcher, address, now) {
  const base = "https://mempool.space/api";
  const validation = await fetchJson(fetcher, base + "/v1/validate-address/" + encodeURIComponent(address));
  if (!object(validation) || validation.isvalid !== true || !sameAddress(validation.address, address)) {
    return { confirmed: false, detail: "The address was not accepted as a valid Bitcoin mainnet address." };
  }
  const [profile, utxos] = await Promise.all([
    fetchJson(fetcher, base + "/address/" + encodeURIComponent(address)),
    fetchJson(fetcher, base + "/address/" + encodeURIComponent(address) + "/utxo")
  ]);
  if (!object(profile) || !sameAddress(profile.address, address) || !Array.isArray(utxos)) throw new Error("Invalid Bitcoin address response");
  const chain = stats(profile.chain_stats);
  const mempool = stats(profile.mempool_stats);
  if (!chain || !mempool) throw new Error("Invalid Bitcoin address statistics");
  return normalize(address, chain, mempool, utxos, "mempool.space",
    validation.iswitness ? "Witness" + (Number.isInteger(validation.witness_version) ? " v" + validation.witness_version : "") :
      validation.isscript ? "Script address" : "Legacy address", now);
}

async function blockstreamScan(fetcher, address, now) {
  const base = "https://blockstream.info/api";
  const [profile, utxos] = await Promise.all([
    fetchJson(fetcher, base + "/address/" + encodeURIComponent(address)),
    fetchJson(fetcher, base + "/address/" + encodeURIComponent(address) + "/utxo")
  ]);
  if (!object(profile) || !sameAddress(profile.address, address) || !Array.isArray(utxos)) throw new Error("Invalid Bitcoin address response");
  const chain = stats(profile.chain_stats);
  const mempool = stats(profile.mempool_stats);
  if (!chain || !mempool) throw new Error("Invalid Bitcoin address statistics");
  return normalize(address, chain, mempool, utxos, "Blockstream Esplora", null, now);
}

function normalize(address, chain, mempool, utxos, source, addressType, now = Date.now) {
  const confirmedBalance = chain.funded_txo_sum - chain.spent_txo_sum;
  const pendingDelta = mempool.funded_txo_sum - mempool.spent_txo_sum;
  const currentBalance = confirmedBalance + pendingDelta;
  if (![confirmedBalance, pendingDelta, currentBalance].every(Number.isSafeInteger)) throw new Error("Invalid Bitcoin balance");
  const cleanUtxos = utxos.slice(0, 10000).flatMap(row => {
    if (!object(row) || typeof row.txid !== "string" || !/^[0-9a-f]{64}$/i.test(row.txid) ||
        !Number.isSafeInteger(row.vout) || row.vout < 0 || satoshis(row.value) === null || !object(row.status)) return [];
    return [{ txid: row.txid, vout: row.vout, value: row.value, confirmed: row.status.confirmed === true }];
  });
  const utxoValue = cleanUtxos.reduce((sum, row) => sum + row.value, 0);
  const unconfirmedUtxos = cleanUtxos.filter(row => !row.confirmed).length;
  const findings = [
    { id: "btcIdentity", section: "identity", label: "Bitcoin address", status: "PASS", source,
      detail: addressType ? "Valid Bitcoin mainnet address · " + addressType + "." : "Valid Bitcoin mainnet address confirmed by the explorer.",
      explanation: "The submitted address was accepted and matched by the Bitcoin data source.", points: 0 },
    { id: "btcHistory", section: "activity", label: "Confirmed history", status: chain.tx_count ? "PASS" : "NOT APPLICABLE", source,
      detail: chain.tx_count + " confirmed transaction(s); " + chain.funded_txo_count + " funded output(s); " +
        chain.spent_txo_count + " spent output(s).",
      explanation: "This reports observed confirmed activity; transaction count alone is not a maliciousness signal.", points: 0 },
    { id: "btcMempool", section: "activity", label: "Unconfirmed activity", status: mempool.tx_count ? "WARNING" : "PASS", source,
      detail: mempool.tx_count ? mempool.tx_count + " unconfirmed transaction(s) currently affect this address." :
        "No unconfirmed transactions currently affect this address.",
      explanation: "Unconfirmed transactions can still be replaced, dropped or reorganized before confirmation.", points: 0 },
    { id: "btcUtxo", section: "funds", label: "Unspent outputs", status: "PASS", source,
      detail: cleanUtxos.length + " UTXO(s) returned, totaling " + btc(utxoValue) + " BTC" +
        (unconfirmedUtxos ? "; " + unconfirmedUtxos + " unconfirmed." : "."),
      explanation: "UTXOs are the currently unspent outputs associated with the address.", points: 0 },
    { id: "btcAttribution", section: "attribution", label: "Known-risk attribution", status: "UNKNOWN", source: "Coverage",
      detail: "No verified sanctions, scam or entity-attribution provider is connected to this public scan.",
      explanation: "On-chain activity by itself does not prove that an address belongs to a scammer, mixer, exchange or sanctioned entity.", points: 0 }
  ];
  const warnings = findings.filter(row => row.status === "WARNING").length;
  const unknown = findings.filter(row => row.status === "UNKNOWN").length;
  return {
    ruleVersion: "sentinel-btc-1",
    reportType: "bitcoin",
    scannedAt: new Date(now()).toISOString(),
    network: "bitcoin",
    networkLabel: "Bitcoin",
    address,
    assetStatus: "CONFIRMED",
    assetDetail: "Bitcoin mainnet address confirmed.",
    asset: { name: "Bitcoin address", symbol: "BTC", supply: null, metadataSource: source, chainPosition: null },
    sources: [{ name: source, status: "AVAILABLE", detail: null }],
    findings,
    risk: { value: null, level: "ADDRESS PROFILE", evidencedPoints: 0, penalties: [], coveredGroups: 3, totalGroups: 4,
      warnings, critical: 0, unknown },
    holders: [],
    holderType: "",
    liquidity: null,
    lpHolders: [],
    sections: [
      ["identity", "Address"],
      ["activity", "Activity"],
      ["funds", "Funds"],
      ["attribution", "Risk attribution"]
    ],
    bitcoin: {
      confirmedBalanceSats: confirmedBalance,
      pendingDeltaSats: pendingDelta,
      currentBalanceSats: currentBalance,
      confirmedTxCount: chain.tx_count,
      unconfirmedTxCount: mempool.tx_count,
      fundedOutputCount: chain.funded_txo_count,
      spentOutputCount: chain.spent_txo_count,
      utxoCount: cleanUtxos.length,
      unconfirmedUtxoCount: unconfirmedUtxos
    },
    limitations: [
      "No verified sanctions, scam or entity-attribution feed is connected to this public Bitcoin scan."
    ]
  };
}

export async function scanBitcoin({ address }, { fetcher = fetch, now = Date.now } = {}) {
  try {
    const result = await mempoolScan(fetcher, address, now);
    return result.confirmed === false ? {
      ruleVersion: "sentinel-btc-1", reportType: "bitcoin", scannedAt: new Date(now()).toISOString(),
      network: "bitcoin", networkLabel: "Bitcoin", address, assetStatus: "NOT FOUND", assetDetail: result.detail,
      asset: { name: "Bitcoin address", symbol: "BTC", supply: null, metadataSource: "mempool.space", chainPosition: null },
      sources: [{ name: "mempool.space", status: "NO MATCH", detail: result.detail }],
      findings: [], risk: { value: null, level: "INVALID ADDRESS", evidencedPoints: 0, penalties: [],
        coveredGroups: 0, totalGroups: 4, warnings: 0, critical: 0, unknown: 0 },
      holders: [], holderType: "", liquidity: null, lpHolders: [], sections: [], bitcoin: null, limitations: []
    } : result;
  } catch {
    const result = await blockstreamScan(fetcher, address, now);
    result.sources.unshift({ name: "mempool.space", status: "UNAVAILABLE", detail: "Primary Bitcoin source was unavailable." });
    return result;
  }
}
