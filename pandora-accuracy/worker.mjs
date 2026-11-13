const PAGE = "/pandora/live-accuracy";
const API = "/api/pandora/live-accuracy";
const headers = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; script-src 'nonce-pandora-live-v1'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
};

async function authorized(request, secret) {
  const token = request.headers.get("Authorization");
  if (!secret || !token || token.length > 128) return false;
  const bytes = new TextEncoder();
  const digest = value => crypto.subtle.digest("SHA-256", bytes.encode(value));
  const [actual, expected] = await Promise.all([digest(token), digest("Bearer " + secret)]);
  return crypto.subtle.timingSafeEqual(actual, expected);
}

function json(value, status = 200) {
  return Response.json(value, { status, headers: { ...headers, "Cache-Control": "no-store" } });
}

// Enforce a strict public field allowlist on both write and read. This also
// sanitizes older KV snapshots published before the privacy update.
const RECEIPT_KEYS = [
  "id", "issued", "target", "call", "probabilities", "baseline",
  "settled", "outcome", "pending_status",
];
const SUMMARY_KEYS = [
  "n", "first_id", "last_id", "model_correct", "baseline_correct",
  "brier", "log_loss", "accuracy_history", "verified_total",
  "source_online", "target_type", "labels",
];
const PUBLIC_HORIZONS = ["60", "900", "3600", "25200", "86400", "604800"];
const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
function publicReceipt(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const key of RECEIPT_KEYS) if (own(raw, key)) out[key] = raw[key];
  if (Array.isArray(out.probabilities) && out.probabilities.length === 3) {
    const p0 = Math.round(Number(out.probabilities[0]) * 10000) / 10000;
    const p1 = Math.round(Number(out.probabilities[1]) * 10000) / 10000;
    out.probabilities = [p0, p1, Math.round((1 - p0 - p1) * 10000) / 10000];
  }
  return out;
}
function publicHorizon(raw) {
  const out = {};
  for (const key of SUMMARY_KEYS) if (own(raw, key)) out[key] = raw[key];
  out.receipts = Array.isArray(raw.receipts) ? raw.receipts.map(publicReceipt).filter(Boolean) : [];
  out.latest = publicReceipt(raw.latest);
  return out;
}
function publicSnapshot(raw) {
  const out = {
    schema: raw.schema,
    as_of: raw.as_of,
    source_online: !!raw.source_online,
  };
  for (const key of SUMMARY_KEYS) if (own(raw, key)) out[key] = raw[key];
  out.receipts = Array.isArray(raw.receipts) ? raw.receipts.map(publicReceipt).filter(Boolean) : [];
  out.pending = publicReceipt(raw.pending);
  out.horizons = {};
  const horizons = raw.horizons && typeof raw.horizons === "object" ? raw.horizons : {};
  for (const key of PUBLIC_HORIZONS) {
    if (horizons[key] && typeof horizons[key] === "object") out.horizons[key] = publicHorizon(horizons[key]);
  }
  return out;
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (![PAGE, PAGE + "/", API, API + "/publish"].includes(path)) return fetch(request);
    if (path === API + "/publish") {
      if (request.method !== "POST") return json({ error: "Not found" }, 404);
      if (!await authorized(request, env.PUBLISH_TOKEN)) return json({ error: "Unauthorized" }, 401);
      const length = Number(request.headers.get("Content-Length"));
      if (!(length > 0 && length <= 128000)) return json({ error: "Invalid payload size" }, 413);
      let snapshot;
      try {
        snapshot = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      if (snapshot.schema !== "pandora-public-accuracy-v1" || !Array.isArray(snapshot.receipts) ||
          !Number.isFinite(snapshot.as_of) || Math.abs(Date.now() / 1000 - snapshot.as_of) > 180) {
        return json({ error: "Invalid or expired snapshot" }, 400);
      }
      await env.ACCURACY.put("current", JSON.stringify(publicSnapshot(snapshot)));
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
    }
    if (path === PAGE || path === PAGE + "/") {
      const originUrl = new URL(request.url);
      originUrl.pathname = PAGE + "/index.html";
      originUrl.search = "";
      // GitHub Pages owns the HTML. Resolve its file explicitly so the public
      // canonical route remains a 200 and shares the Pages deployment.
      const origin = await fetch(originUrl, { method: request.method, redirect: "manual" });
      if (!origin.ok || !origin.headers.get("Content-Type")?.startsWith("text/html")) {
        return new Response("Live Accuracy is temporarily unavailable.", {status: 503, headers});
      }
      return new Response(origin.body, {
        headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
      });
    }
    if (path === API) {
      const snapshot = await env.ACCURACY.get("current", { cacheTtl: 30 });
      if (!snapshot) return json({ error: "Awaiting first publication" }, 503);
      // Sanitize older persisted snapshots at read time as well.
      let publicData;
      try {
        publicData = publicSnapshot(JSON.parse(snapshot));
      } catch {
        return json({ error: "Invalid ledger" }, 503);
      }
      return new Response(request.method === "HEAD" ? null : JSON.stringify(publicData), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=15" },
      });
    }
    return json({ error: "Not found" }, 404);
  },
};
