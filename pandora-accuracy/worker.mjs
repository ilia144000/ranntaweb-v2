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
      await env.ACCURACY.put("current", JSON.stringify(snapshot));
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
      return new Response(request.method === "HEAD" ? null : snapshot ?? '{"error":"Awaiting first publication"}', {
        status: snapshot ? 200 : 503,
        headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=15" },
      });
    }
    return json({ error: "Not found" }, 404);
  },
};
