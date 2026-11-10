import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";
import { createHandler, endpoint } from "./handler.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const handle = createHandler({ bearer: process.env.SENTINEL_GOPLUS_TOKEN });
const types = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp",
  xml: "application/xml", ico: "image/x-icon", json: "application/json", woff2: "font/woff2" };
const port = Number(process.env.SENTINEL_PORT || 8794);
const origin = "http://127.0.0.1:" + port;

createServer({ requestTimeout: 10000 }, async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.origin !== origin) return res.writeHead(400).end();
    if (url.pathname === endpoint) {
      const request = new Request(url, { method: req.method, headers: req.headers,
        ...(!["GET", "HEAD"].includes(req.method) && { body: Readable.toWeb(req), duplex: "half" }) });
      const response = await handle(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(await response.text());
    }
    if (!["GET", "HEAD"].includes(req.method)) return res.writeHead(405).end();
    const path = decodeURIComponent(url.pathname);
    if (!/^\/(?:[\w-]+\/)*[\w.-]*\/?$/.test(path) || path.split("/").some(part => part.startsWith(".")) ||
        path.startsWith("/sentinel-server") || path.startsWith("/scripts")) return res.writeHead(404).end();
    const base = resolve(root, "." + path);
    if (base !== resolve(root) && !base.startsWith(resolve(root) + sep)) return res.writeHead(404).end();
    const entry = await stat(base).catch(() => null);
    const file = entry?.isDirectory() ? resolve(base, "index.html") : base;
    const type = types[file.split(".").at(-1)];
    if (!type || !(await stat(file).catch(() => null))?.isFile()) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": type, "x-content-type-options": "nosniff" });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).on("error", () => res.destroy()).pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(400);
    res.end();
  }
}).listen(port, "127.0.0.1", () => process.stdout.write("Sentinel at " + origin + "/sentinel\n"));
