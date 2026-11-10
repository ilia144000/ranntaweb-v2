import test from "node:test";
import assert from "node:assert/strict";
import { normalizeInput, abiText, boundedJson, fetchJson } from "./upstreams.mjs";
import { scan } from "./scanner.mjs";
import { inspectSolanaIndex, recheckIndexedAccounts } from "./solana.mjs";
import { createHandler, endpoint } from "./handler.mjs";
import { findingsFrom, score } from "./rules.mjs";

const evm = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const token2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const implementation = "0x" + "a1".repeat(20);
const holder = "0x" + "b2".repeat(20);
const word = value => "0x" + BigInt(value).toString(16).padStart(64, "0");
const rawText = value => "0x" + Buffer.from(value).toString("hex").padEnd(64, "0");
const f = (result, id) => result.findings.find(item => item.id === id);

function fixture({ verified = true, dexDown = false, allDown = false, tokenData = {}, wrongChain = false,
  modern = false, holderSlot = 111, legacyProxy = false, noCode = false } = {}) {
  return async (url, options) => {
    assert.equal(options.redirect, "manual");
    assert.ok(options.signal instanceof AbortSignal);
    const target = new URL(url);
    if (allDown) throw new Error("offline");
    if (target.hostname === "ethereum-rpc.publicnode.com") {
      const payload = JSON.parse(options.body);
      const calls = Array.isArray(payload) ? payload : [payload];
      const values = {
        "0x06fdde03": rawText("<img onerror=bad>"), "0x95d89b41": rawText("TST"),
        "0x313ce567": word(6), "0x18160ddd": word(2300000), "0x8da5cb5b": word(0),
        "0x5c975abb": word(0)
      };
      const response = calls.map(({ id, method, params }) => {
        if (!["eth_chainId", "eth_blockNumber"].includes(method)) assert.equal(params.at(-1), "0x1a");
        const result = {
          eth_chainId: wrongChain ? "0x89" : "0x1", eth_blockNumber: "0x1a", eth_getCode: noCode ? "0x" : "0x6000",
          eth_getStorageAt: params[1]?.startsWith(legacyProxy ? "0x7050" : "0x3608") ? word(implementation) :
            legacyProxy && params[1]?.startsWith("0x10d6") ? word(holder) : word(0),
          eth_call: values[params[0]?.data]
        }[method];
        return { jsonrpc: "2.0", id, result };
      }).reverse();
      return Response.json(Array.isArray(payload) ? response : response[0]);
    }
    if (target.hostname === "solana-rpc.publicnode.com") {
      const call = JSON.parse(options.body);
      assert.equal(call.params[1].commitment, "finalized");
      const result = call.method === "getTokenLargestAccounts" ?
        { context: { slot: holderSlot }, value: [{ address: mint, amount: "40" }] } :
        { context: { slot: 111 }, value: {
          owner: modern ? token2022 : "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          data: { parsed: { type: "mint", info: { isInitialized: true, decimals: 0, supply: "100",
            mintAuthority: mint, freezeAuthority: null, ...(modern ? { extensions: [
              { extension: "transferFeeConfig", state: { transferFeeConfigAuthority: mint,
                olderTransferFee: { transferFeeBasisPoints: 40 }, newerTransferFee: { transferFeeBasisPoints: 2100 } } },
              { extension: "permanentDelegate", state: { delegate: mint } },
              { extension: "transferHook", state: { programId: mint } },
              { extension: "tokenMetadata", state: { name: "Parsed token", symbol: "PAR", updateAuthority: mint } }
            ] } : {}) } } }
        } };
      return Response.json({ jsonrpc: "2.0", id: call.id, result });
    }
    if (target.hostname === "sourcify.dev") {
      if (!verified) return new Response(null, { status: 404 });
      return Response.json({ match: "exact_match", abi: [
        { type: "function", name: target.pathname.endsWith(implementation) ? "mint" : "implementation" }
      ] });
    }
    if (target.hostname === "api.gopluslabs.io") {
      if (target.pathname.includes("/solana/")) return Response.json({ code: 1, result: {} });
      return Response.json({ code: 1, result: { [evm]: { token_name: "Provider name",
        buy_tax: "0.02", sell_tax: "0.20", transfer_tax: "0", is_honeypot: "0", cannot_sell_all: "0", cannot_buy: "0",
        holders: [{ address: holder, percent: "0.1" }],
        creator_percent: "0.30", ...tokenData } } });
    }
    if (target.hostname === "api.dexscreener.com") {
      if (dexDown) return new Response(null, { status: 503 });
      const network = target.pathname.includes("ethereum") ? "ethereum" : "solana";
      const address = network === "ethereum" ? evm : mint;
      const pairAddress = network === "ethereum" ? holder : mint;
      const pair = { chainId: network, pairAddress, dexId: "dex", baseToken: { address, name: "DEX token" },
        liquidity: { usd: 90000 } };
      return Response.json([pair, pair, { ...pair, chainId: "invalid" }, { ...pair, liquidity: { usd: "fake" } }]);
    }
    throw new Error("Unexpected upstream " + target.origin);
  };
}

test("network and address validation includes exact Solana decoded length", () => {
  assert.deepEqual(normalizeInput({ network: "ethereum", address: "  0x" + evm.slice(2).toUpperCase() }), { network: "ethereum", address: evm });
  assert.deepEqual(normalizeInput({ network: "solana", address: mint }), { network: "solana", address: mint });
  for (const input of [
    { network: "base", address: "0x0000" }, { network: "solana", address: "1".repeat(44) },
    { network: "solana", address: "0" + mint.slice(1) }, { network: "__proto__", address: evm },
    { network: { toString: null }, address: evm }, { network: "polygon", address: "http://169.254.169.254" }
  ]) assert.equal(normalizeInput(input), null);
});

test("verified EVM contract detects proxy and implementation ABI mint interface", async () => {
  const result = await scan({ network: "ethereum", address: evm }, { fetcher: fixture() });
  assert.equal(result.assetStatus, "CONFIRMED");
  assert.equal(result.asset.name, "<img onerror=bad>");
  assert.equal(result.asset.supply, "2.3");
  assert.equal(f(result, "verification").status, "PASS");
  assert.match(f(result, "verification").detail, /Implementation: exact match/);
  assert.match(f(result, "proxy").detail, /EIP-1967 implementation/);
  assert.equal(f(result, "mint").status, "WARNING");
  assert.equal(f(result, "mint").source, "Sourcify");
  assert.equal(f(result, "tax").status, "HIGH RISK");
  assert.equal(f(result, "transferFee").status, "PASS");
  assert.equal(f(result, "owner").status, "PASS");
  assert.equal(result.liquidity.poolCount, 1);
  assert.equal(result.risk.value, result.risk.penalties.reduce((sum, row) => sum + row.points, 0));
});

test("legacy proxy recognized and missing Sourcify record stays unknown", async () => {
  const result = await scan({ network: "ethereum", address: evm },
    { fetcher: fixture({ verified: false, legacyProxy: true, tokenData: { is_mintable: "1" } }) });
  assert.equal(f(result, "verification").status, "UNKNOWN");
  assert.match(f(result, "verification").detail, /No Sourcify match/);
  assert.match(f(result, "proxy").detail, /ZeppelinOS implementation/);
  assert.equal(f(result, "mint").status, "WARNING");
  assert.equal(f(result, "mint").source, "GoPlus Security");
});

test("outage preserves partial findings without declaring unknown evidence safe", async () => {
  const result = await scan({ network: "ethereum", address: evm }, { fetcher: fixture({ dexDown: true }) });
  assert.equal(result.assetStatus, "CONFIRMED");
  assert.equal(f(result, "liquidity").status, "UNKNOWN");
  assert.equal(result.sources.find(item => item.name === "DEX Screener").status, "UNAVAILABLE");
  const failed = await scan({ network: "ethereum", address: evm }, { fetcher: fixture({ allDown: true }) });
  assert.equal(failed.risk.value, null);
  assert.equal(failed.risk.level, "INSUFFICIENT EVIDENCE");
  assert.equal(failed.risk.unknown, failed.findings.length);
});

test("a rate-limited EVM RPC falls back with bounded, block-pinned batches", async () => {
  const upstream = fixture();
  const fallbackBatches = [];
  const fetcher = (url, options) => {
    const host = new URL(url).hostname;
    if (host === "ethereum-rpc.publicnode.com") return new Response(null, { status: 429 });
    if (host === "eth-mainnet.public.blastapi.io") {
      const payload = JSON.parse(options.body);
      fallbackBatches.push(Array.isArray(payload) ? payload.length : 1);
      return upstream("https://ethereum-rpc.publicnode.com", options);
    }
    return upstream(url, options);
  };
  const result = await scan({ network: "ethereum", address: evm }, { fetcher });
  assert.equal(result.assetStatus, "CONFIRMED");
  assert.equal(result.asset.metadataSource, "Blast Ethereum RPC");
  assert.equal(f(result, "proxy").source, "Blast Ethereum RPC");
  assert.match(result.sources.find(item => item.name === "PublicNode EVM RPC").detail, /429/);
  assert.deepEqual(fallbackBatches, [2, 1, 3, 3, 3, 2]);
});

test("optional RPC rate limits do not invalidate confirmed on-chain code", async () => {
  const upstream = fixture();
  const fetcher = (url, options) => {
    const host = new URL(url).hostname;
    if (host === "ethereum-rpc.publicnode.com") return new Response(null, { status: 429 });
    if (host === "eth-mainnet.public.blastapi.io") {
      const payload = JSON.parse(options.body);
      if (Array.isArray(payload) && payload.some(call => call.method === "eth_call")) {
        return new Response(null, { status: 429 });
      }
      return upstream("https://ethereum-rpc.publicnode.com", options);
    }
    return upstream(url, options);
  };
  const result = await scan({ network: "ethereum", address: evm }, { fetcher });
  assert.equal(result.assetStatus, "CONFIRMED");
  assert.equal(result.asset.supply, null);
  assert.equal(result.sources.find(item => item.name === "Blast Ethereum RPC").status, "PARTIAL");
});

test("wrong-chain and no-code evidence do not produce a risk score", async () => {
  const wrong = await scan({ network: "ethereum", address: evm }, { fetcher: fixture({ wrongChain: true }) });
  assert.equal(wrong.assetStatus, "UNCONFIRMED");
  assert.equal(wrong.risk.value, null);
  const empty = await scan({ network: "ethereum", address: evm }, { fetcher: fixture({ noCode: true }) });
  assert.equal(empty.assetStatus, "NOT FOUND");
  assert.equal(empty.risk.value, null);
  assert.deepEqual(empty.holders, []);
  assert.equal(empty.liquidity, null);
});

test("legacy Solana mint uses matching slot, mint authority and account-based concentration", async () => {
  const result = await scan({ network: "solana", address: mint }, { fetcher: fixture() });
  assert.equal(result.assetStatus, "CONFIRMED");
  assert.equal(result.asset.supply, "100");
  assert.equal(f(result, "mint").status, "WARNING");
  assert.equal(f(result, "deny").status, "PASS");
  assert.equal(f(result, "delegate").status, "NOT APPLICABLE");
  assert.equal(f(result, "holders").status, "WARNING");
  assert.equal(result.holders[0].percentage, 40);
  assert.ok(!result.findings.some(item => item.id === "proxy"));
});

test("Token-2022 distinguishes fee, delegate, hook, metadata and mismatched slots", async () => {
  const result = await scan({ network: "solana", address: mint }, { fetcher: fixture({ modern: true, holderSlot: 112 }) });
  assert.equal(f(result, "holders").status, "UNKNOWN");
  assert.equal(f(result, "transferFee").status, "HIGH RISK");
  for (const id of ["delegate", "hook", "metadata", "feeControl"]) assert.equal(f(result, id).status, "WARNING");
  assert.equal(result.asset.name, "Parsed token");
});

test("Solana index mismatch is unscored and rechecked balances use one slot and verified owners", async () => {
  const program = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const owner = "11111111111111111111111111111111";
  const account = "So11111111111111111111111111111111111111112";
  const mismatch = await inspectSolanaIndex(async () => Response.json({ code: 1, result: {
    [mint]: { total_supply: "50", holders: [{ account: owner, percent: "0.75", token_account: account }] }
  } }), mint, undefined, { supply: "100" });
  assert.equal(mismatch.evidence.holders.status, "UNKNOWN");
  const result = await recheckIndexedAccounts(async (url, options) => {
    assert.equal(JSON.parse(options.body).method, "getMultipleAccounts");
    assert.deepEqual(JSON.parse(options.body).params[0], [mint, account]);
    return Response.json({ jsonrpc: "2.0", id: 0, result: { context: { slot: 141 }, value: [
      { owner: program, data: { parsed: { type: "mint", info: { supply: "100" } } } },
      { owner: program, data: { parsed: { type: "account", info: { mint, owner, tokenAmount: { amount: "25" } } } } }
    ] } });
  }, "https://solana-rpc.publicnode.com", mint, mismatch);
  assert.deepEqual(result.rows, [{ address: owner, percentage: 25 }]);
  assert.match(result.evidence.holders.detail, /at least 25.00% at finalized slot 141/);
  assert.equal(result.evidence.holders.status, "WARNING");
});

test("empty and malformed ABI results stay unknown; bounded JSON cancels over limit", async () => {
  assert.equal(abiText("0x" + "0".repeat(120)), null);
  assert.equal(abiText(word(32) + word(400).slice(2)), null);
  await assert.rejects(boundedJson(Response.json({ x: "x".repeat(200) }).body, 32), /size limit/);
  await assert.rejects(fetchJson(async () => new Response("broken", { status: 200 }),
    "https://test.invalid/"), SyntaxError);
  await assert.rejects(fetchJson(async (url, options) => {
    assert.equal(url, "https://test.invalid/");
    assert.equal(options.redirect, "manual");
    return Response.redirect("https://other.invalid/");
  }, "https://test.invalid/"), /Upstream HTTP 302/);
});

const request = (body, headers = {}) => new Request("https://rannta.com" + endpoint, {
  method: "POST", headers: { "content-type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body)
});
const requestBody = { network: "ethereum", address: evm };
const success = { assetStatus: "CONFIRMED", sources: [], marker: 1 };

test("public handler rejects malicious, invalid, oversized, malformed and cross-origin requests", async () => {
  let invocations = 0;
  const handle = createHandler({ perform: () => { invocations++; } });
  for (const body of ["{", { network: "solana", address: "0OIl" }, { network: "ethereum", address: "<script>" },
    { ...requestBody, url: "http://127.0.0.1" }, { network: { toString: "ethereum" }, address: evm }]) {
    assert.equal((await handle(request(body))).status, 400);
  }
  assert.equal((await handle(request("x".repeat(1100)))).status, 413);
  assert.equal((await handle(request(requestBody, { origin: "https://other.invalid" }))).status, 403);
  assert.equal((await handle(request(requestBody, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await handle(new Request("https://rannta.com" + endpoint))).status, 405);
  assert.equal(invocations, 0);
});

test("duplicate work is coalesced and cached with bounded TTL and capacity", async () => {
  let now = 10000;
  let calls = 0;
  const handle = createHandler({ now: () => now, maxEntries: 1, perform: () => { calls++; return success; } });
  const first = await Promise.all([handle(request(requestBody)), handle(request(requestBody))]);
  assert.equal(first[0].status, 200);
  assert.equal(calls, 1);
  assert.equal((await (await handle(request(requestBody))).json()).cached, true);
  now += 45001;
  assert.equal((await (await handle(request(requestBody))).json()).cached, false);
  await handle(request({ ...requestBody, network: "base" }));
  await handle(request(requestBody));
  assert.equal(calls, 4);
});

test("worker rate limit bounds distinct scans per client and resets by minute", async () => {
  let now = 0;
  const handle = createHandler({ now: () => now, clientKey: () => "same-client", perform: () => success });
  const scanAt = index => handle(request({ ...requestBody, address: "0x" + index.toString(16).padStart(40, "0") }));
  for (let index = 0; index < 20; index++) assert.equal((await scanAt(index)).status, 200);
  assert.equal((await scanAt(21)).status, 429);
  assert.equal((await scanAt(19)).status, 200);
  now = 60000;
  assert.equal((await scanAt(21)).status, 200);
});

test("uncertainty stays separate from points and score caps at 100", () => {
  const selected = Object.keys({ owner: 1, mint: 1, proxy: 1, liquidity: 1, honeypot: 1, holders: 1 });
  const all = findingsFrom(Object.fromEntries(selected.map(id => [id, { status: "HIGH RISK", source: "test", detail: "positive" }])), selected);
  assert.equal(score(all, true).value, 100);
  assert.equal(score(all, false).value, null);
  assert.equal(score(all, false).evidencedPoints, 100);
  assert.equal(score(findingsFrom({}, selected), true).value, null);
});
