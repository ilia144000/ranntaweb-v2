import { boundedJson, normalizeInput } from "./upstreams.mjs";
import { scan } from "./scanner.mjs";

export const endpoint = "/api/sentinel/scan";
const reply = (body, status = 200, headers = {}) => Response.json(body, {
  status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers }
});

export function createHandler({ perform = scan, now = Date.now, maxEntries = 128, maxActive = 6, bearer, clientKey } = {}) {
  const cache = new Map();
  const active = new Map();
  const clients = new Map();

  return async function handle(request) {
    const url = new URL(request.url);
    if (url.pathname !== endpoint) return reply({ error: "Route not found." }, 404);
    if (request.method !== "POST") return reply({ error: "Use POST." }, 405, { allow: "POST" });
    if ((request.headers.has("origin") && request.headers.get("origin") !== url.origin) ||
        request.headers.get("sec-fetch-site") === "cross-site") {
      return reply({ error: "Submit scans from the RANNTA site." }, 403);
    }
    const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (type !== "application/json") return reply({ error: "Expected application/json." }, 415);
    if (Number(request.headers.get("content-length")) > 1024) return reply({ error: "Scan request exceeds 1024 bytes." }, 413);
    let input;
    try {
      const body = await boundedJson(request.body, 1024);
      if (body && typeof body === "object" && Object.keys(body).length === 2) input = normalizeInput(body);
    } catch (error) {
      if (error.message === "Response exceeds size limit") return reply({ error: "Scan request exceeds 1024 bytes." }, 413);
      return reply({ error: "Malformed scan request." }, 400);
    }
    if (!input) return reply({ error: "Select a supported network and enter a valid address for it." }, 400);

    const key = input.network + ":" + input.address;
    const cached = cache.get(key);
    if (cached?.expires > now()) {
      cache.delete(key);
      cache.set(key, cached);
      return reply({ ...cached.value, cached: true });
    }
    cache.delete(key);
    let work = active.get(key);
    if (!work) {
      if (active.size >= maxActive) return reply({ error: "Scanner is busy. Try again in a few seconds." }, 429, { "retry-after": "5" });
      const client = clientKey?.(request);
      if (client) {
        const minute = Math.floor(now() / 60000);
        const bucket = clients.get(client);
        if (bucket?.minute === minute && bucket.count >= 20) {
          return reply({ error: "Too many scans. Please wait a minute." }, 429, { "retry-after": "60" });
        }
        clients.delete(client);
        clients.set(client, { minute, count: bucket?.minute === minute ? bucket.count + 1 : 1 });
        if (clients.size > 2048) clients.delete(clients.keys().next().value);
      }
      work = Promise.resolve().then(() => perform(input, { now, bearer })).then(value => {
        const ttl = value.assetStatus === "CONFIRMED" && !value.sources.some(source => ["PARTIAL", "UNAVAILABLE"].includes(source.status)) ? 45000 : 5000;
        cache.set(key, { value, expires: now() + ttl });
        if (cache.size > maxEntries) cache.delete(cache.keys().next().value);
        return value;
      }).finally(() => active.delete(key));
      active.set(key, work);
    }
    try {
      return reply({ ...await work, cached: false });
    } catch {
      return reply({ error: "The scanner could not complete this request." }, 502);
    }
  };
}
