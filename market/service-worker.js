/* ===================== RANNTA ARCA — service-worker.js ===================== */
const VER = 'v1.0.1';
const CACHE_STATIC  = `arca-static-${VER}`;
const CACHE_DYNAMIC = `arca-dyn-${VER}`;
const CACHE_IMAGES  = `arca-img-${VER}`;

/* Adjust paths to your structure if needed */
const CORE_ASSETS = [
  '/market/',
  '/market/index.html',
  '/market/collection.html',
  '/market/profile.html',
  '/market/nft.html',
  '/market/create.html',
  '/market/dashboard.html',
  '/market/assets/marketplace.css',
  '/market/assets/app.js',
  '/market/assets/tonconnect-ui.min.js',
  '/market/manifest.webmanifest',
  '/market/tonconnect-manifest.json',
  '/market/assets/rannta-arca.png'
];

/* IPFS gateways (first is the default; others are fallbacks) */
const IPFS_GW = [
  'https://cloudflare-ipfs.com',
  'https://ipfs.io',
  'https://gateway.pinata.cloud'
];

/* ------------------------ Install: pre-cache core ------------------------ */
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_STATIC).then((c) => c.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ------------------------ Activate: cleanup old ------------------------- */
self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![CACHE_STATIC, CACHE_DYNAMIC, CACHE_IMAGES].includes(k))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ----------------------------- Helpers ---------------------------------- */
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

async function networkFirst(req, { cacheName = CACHE_DYNAMIC, t = 5000 } = {}) {
  try {
    const res = await Promise.race([fetch(req), timeout(t)]);
    if (res && res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
      return res;
    }
    throw new Error('network not ok');
  } catch {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    if (cached) return cached;
    throw new Error('no cache');
  }
}

async function cacheFirst(req, { cacheName = CACHE_STATIC }) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

function isSameOrigin(u) {
  try { return new URL(u, self.location.origin).origin === self.location.origin; }
  catch { return false; }
}

/* Fetch IPFS with multi-gateway fallback; return a placeholder if all fail */
async function fetchIpfsWithFallback(reqUrl) {
  const m = reqUrl.match(/\/ipfs\/([^/?#]+)(\/.*)?$/);
  if (!m) return fetch(reqUrl, { mode: 'no-cors' });

  const [, cid, tail = '' ] = m;
  for (const gw of IPFS_GW) {
    const tryUrl = `${gw}/ipfs/${cid}${tail}`;
    try {
      const res = await fetch(tryUrl, { cache: 'reload' });
      if (res.ok) return res;
    } catch {}
  }

  // Minimal SVG placeholder
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="100%" height="100%" fill="#111"/>
      <text x="50%" y="45%" fill="#888" font-size="28" text-anchor="middle" font-family="system-ui, Arial">
        IPFS image unavailable
      </text>
      <text x="50%" y="55%" fill="#666" font-size="18" text-anchor="middle" font-family="system-ui, Arial">
        RANNTA ARCA
      </text>
    </svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' }, status: 200 });
}

/* --------------------------- Fetch router ------------------------------- */
self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // JSON (data): network-first with cache fallback (keeps lists fresh)
  if (url.pathname.endsWith('.json')) {
    evt.respondWith(
      networkFirst(req, { cacheName: CACHE_DYNAMIC, t: 6000 })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Images: cache-first; if IPFS path, try multiple gateways
  if (req.destination === 'image') {
    evt.respondWith((async () => {
      const cache = await caches.open(CACHE_IMAGES);
      const cached = await cache.match(req);
      if (cached) return cached;

      let res;
      try {
        if (/\/ipfs\//.test(url.pathname)) {
          res = await fetchIpfsWithFallback(req.url);
        } else {
          res = await fetch(req, { cache: 'reload' });
        }
      } catch {
        return fetchIpfsWithFallback(req.url);
      }
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Same-origin static files: cache-first
  if (isSameOrigin(req.url) && (
      url.pathname.startsWith('/market/') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.html')
    )) {
    evt.respondWith(cacheFirst(req, { cacheName: CACHE_STATIC }));
    return;
  }

  // Everything else: network-first with cache fallback
  evt.respondWith(
    networkFirst(req, { cacheName: CACHE_DYNAMIC, t: 6000 })
      .catch(() => caches.match(req))
  );
});
