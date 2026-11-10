export const networks = Object.freeze({
  ethereum: { label: "Ethereum", chain: 1, rpc: "https://ethereum-rpc.publicnode.com",
    fallbacks: [
      { rpc: "https://eth-mainnet.public.blastapi.io", rpcLabel: "Blast Ethereum RPC", batchSize: 3 },
      { rpc: "https://ethereum-public.nodies.app", rpcLabel: "Nodies Ethereum RPC", batchSize: 3 }
    ] },
  bsc: { label: "BNB Chain", chain: 56, rpc: "https://bsc-rpc.publicnode.com",
    fallbacks: [{ rpc: "https://bsc-dataseed.bnbchain.org", rpcLabel: "BNB Chain RPC" }] },
  base: { label: "Base", chain: 8453, rpc: "https://base-rpc.publicnode.com",
    fallbacks: [
      { rpc: "https://base-mainnet.public.blastapi.io", rpcLabel: "Blast Base RPC", batchSize: 3 },
      { rpc: "https://public.1rpc.io/base", rpcLabel: "1RPC Base", batchSize: 3 }
    ] },
  polygon: { label: "Polygon", chain: 137, rpc: "https://polygon-bor-rpc.publicnode.com",
    fallbacks: [
      { rpc: "https://public.1rpc.io/matic", rpcLabel: "1RPC Polygon", batchSize: 3 },
      { rpc: "https://polygon.drpc.org", rpcLabel: "dRPC Polygon", batchSize: 3 }
    ] },
  solana: { label: "Solana", rpc: "https://solana-rpc.publicnode.com" }
});

const base58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function normalizeInput(input) {
  if (!input || typeof input.network !== "string" || !Object.hasOwn(networks, input.network) ||
      typeof input.address !== "string") return null;
  const network = input.network;
  const address = input.address.trim();
  if (network !== "solana") {
    return /^0x[0-9a-fA-F]{40}$/.test(address) ? { network, address: address.toLowerCase() } : null;
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return null;
  let decoded = 0n;
  for (const char of address) decoded = decoded * 58n + BigInt(base58.indexOf(char));
  const leadingZeros = address.match(/^1*/)[0].length;
  const length = decoded === 0n ? 0 : Math.ceil(decoded.toString(16).length / 2);
  return leadingZeros + length === 32 ? { network, address } : null;
}

export async function boundedJson(body, limit) {
  if (!body) throw new Error("Empty JSON body");
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Response exceeds size limit");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    try { await reader.cancel(); } catch { /* Already closed or aborted. */ }
    reader.releaseLock();
  }
}

export async function fetchJson(fetcher, url, options = {}) {
  const response = await fetcher(url, {
    ...options, signal: AbortSignal.timeout(6500), redirect: "manual",
    headers: { accept: "application/json", ...options.headers }
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 404) return null;
    throw new Error("Upstream HTTP " + response.status);
  }
  const limit = 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new Error("Response exceeds size limit");
  }
  return boundedJson(response.body, limit);
}

export async function rpc(fetcher, endpoint, calls, batch = true) {
  const payload = calls.map(([method, params], id) => ({ jsonrpc: "2.0", id, method, params }));
  const response = await fetchJson(fetcher, endpoint, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(batch ? payload : payload[0])
  });
  if (!response || (batch && !Array.isArray(response))) throw new Error("Invalid RPC response");
  const entries = batch ? response : [response];
  const ids = new Map();
  for (const item of entries) {
    if (item?.jsonrpc !== "2.0" || !Number.isInteger(item.id) || item.id < 0 ||
        item.id >= calls.length || ids.has(item.id)) throw new Error("Invalid RPC response ID");
    ids.set(item.id, item);
  }
  if (!payload.some(({ id }) => Object.hasOwn(ids.get(id) ?? {}, "result"))) {
    throw new Error("RPC returned no readable results");
  }
  return payload.map(({ id }) => ids.get(id)?.result);
}

export const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
export const clean = (value, max = 100) => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim().slice(0, max) || null : null;
export const hexWord = value => typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value) ? value : null;
export const uint = value => hexWord(value) ? BigInt(value) : null;
export const decimalAmount = value => typeof value === "string" && /^\d{1,78}$/.test(value) ? BigInt(value) : null;
export function units(amount, decimals) {
  if (amount === null || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) return null;
  const digits = amount.toString().padStart(decimals + 1, "0");
  if (!decimals) return digits;
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  return digits.slice(0, -decimals) + (fraction ? "." + fraction : "");
}

export function abiText(value) {
  if (typeof value !== "string" || !/^0x(?:[0-9a-f]{2}){32,512}$/i.test(value)) return null;
  let bytes;
  if (value.length === 66) bytes = value.slice(2).replace(/(?:00)+$/, "");
  else {
    if (uint(value.slice(0, 66)) !== 32n) return null;
    const length = uint("0x" + value.slice(66, 130));
    if (length === null || length > 160n || value.length < 130 + Number(length) * 2) return null;
    bytes = value.slice(130, 130 + Number(length) * 2);
  }
  try {
    return clean(new TextDecoder("utf-8", { fatal: true })
      .decode(Uint8Array.from(bytes.match(/../g) ?? [], pair => Number.parseInt(pair, 16))));
  } catch { return null; }
}
