import { createHandler } from "./handler.mjs";

let handler;
const canonicalPages = new Set(["/sentinel", "/security", "/tools"]);
export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (canonicalPages.has(url.pathname) && ["GET", "HEAD"].includes(request.method)) {
      // GitHub Pages serves directory indexes at slash-terminated paths.
      url.pathname += "/";
      return fetch(new Request(url, request));
    }
    handler ??= createHandler({ bearer: env.SENTINEL_GOPLUS_TOKEN,
      clientKey: request => request.headers.get("cf-connecting-ip") });
    return handler(request);
  }
};
