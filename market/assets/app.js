/* ===================== RANNTA ARCA — app.js (pro) ===================== */
/* Config */
const TON_MANIFEST_URL = 'https://rannta.com/market/tonconnect-manifest.json';
const NFT_SRC = 'nfts.json';
const TON_PRICE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PAGE_SIZE = 24; // cards per page
const IPFS_GATEWAYS = [
  (cid) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid) => `https://ipfs.io/ipfs/${cid}`,
  (cid) => `https://gateway.pinata.cloud/ipfs/${cid}`
];

/* Globals */
let tonConnectUI = null;
let allNFTs = [];
let filtered = [];
let page = 1;

/* Shortcuts & Utils */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const TON_ADDR_RE = /^[A-Za-z0-9_\-]{20,64}$/;
const toNano = (ton) => Math.round(Number(ton || 0) * 1e9).toString();
const formatTON = (n) => `${Number(n || 0)} TON`;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const safeStr = (v) => (v == null ? '' : String(v));
const stableSort = (arr, cmp) =>
  arr.map((v, i) => [v, i]).sort((a, b) => cmp(a[0], b[0]) || a[1] - b[1]).map(([v]) => v);

const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

function ipfsToHttp(url) {
  if (!url) return '';
  if (!/^ipfs:\/\//i.test(url)) return url;
  const cid = url.replace(/^ipfs:\/\//i, '').replace(/^ipfs\//i, '');
  return IPFS_GATEWAYS[0](cid);
}

async function withGatewayFallback(urls) {
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: 'force-cache' });
      if (res.ok) return u;
    } catch {}
  }
  return urls[0];
}

/* Robust fetch with retry + timeout */
async function fetchJSON(url, { retries = 2, timeout = 10000, cache = 'no-store' } = {}) {
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { cache, signal: ctrl.signal });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      clearTimeout(id);
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
}

/* TON price cache */
async function getTonUsd() {
  const key = 'ton_usd_cache_v1';
  const cached = JSON.parse(localStorage.getItem(key) || 'null');
  const now = Date.now();
  if (cached && now - cached.t < TON_PRICE_TTL_MS) return cached.v;

  // Try Coingecko then TONAPI (two fallbacks)
  let price = null;
  try {
    const cg = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd', { cache: 'no-store' });
    price = cg?.['the-open-network']?.usd ?? null;
  } catch {}
  if (price == null) {
    try {
      const ta = await fetchJSON('https://tonapi.io/v2/rates?tokens=ton&currencies=usd', { cache: 'no-store' });
      price = ta?.rates?.ton?.prices?.USD ?? null;
    } catch {}
  }
  if (price != null) {
    localStorage.setItem(key, JSON.stringify({ v: price, t: now }));
    return price;
  }
  return null;
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

/* TonConnect bootstrap */
function ensureTon() {
  const mountPoint = document.getElementById('tonconnect');
  if (!mountPoint) { console.error('[ARCA] #tonconnect not found.'); return; }
  if (!window.TON_CONNECT_UI) { console.error('[ARCA] tonconnect-ui.min.js not loaded.'); return; }
  if (!tonConnectUI) {
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({ manifestUrl: TON_MANIFEST_URL });
    tonConnectUI.mount('#tonconnect');
    wireWalletState();
  }
}

/* Wallet state → nav/profile/localStorage */
function wireWalletState() {
  const update = () => {
    const acc = tonConnectUI?.account;
    const nav = document.getElementById('nav-profile');
    if (acc) {
      const addr = acc.address;
      if (nav) nav.href = `profile.html?address=${addr}`;
      localStorage.setItem('rannta_wallet', addr);
    } else {
      localStorage.removeItem('rannta_wallet');
    }
  };
  tonConnectUI.onStatusChange(update);
  update();
}

/* Data */
async function loadNFTs(src = NFT_SRC) {
  try {
    const raw = await fetchJSON(src, { cache: 'no-store' });
    // Normalize & precompute
    allNFTs = (Array.isArray(raw) ? raw : raw.items || []).map((n) => ({
      ...n,
      image: ipfsToHttp(n.image),
      price: Number(n.price || 0),
      name: safeStr(n.name),
      collection: safeStr(n.collection),
      owner: safeStr(n.owner),
      address: safeStr(n.address),
      saleAddress: safeStr(n.saleAddress),
      traits: n.traits || {}
    }));
    filtered = allNFTs.slice();
  } catch (e) {
    console.error('Failed to load nfts.json', e);
    const grid = $('#grid');
    if (grid) grid.textContent = 'Failed to load nfts.json';
  }
}

/* Secure grid renderer (no innerHTML) + pagination */
function renderGrid(list) {
  const grid = $('#grid');
  if (!grid) return;
  grid.textContent = '';

  const start = (page - 1) * PAGE_SIZE;
  const slice = list.slice(start, start + PAGE_SIZE);

  slice.forEach((nft) => {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.className = 'thumb';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = nft.image || '';
    img.alt = nft.name || 'NFT';
    card.appendChild(img);

    const pad = document.createElement('div');
    pad.className = 'pad';
    card.appendChild(pad);

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = nft.name || '—';

    if (nft.badge === 'blue') {
      const b = document.createElement('span'); b.textContent = '✔'; b.style.color = '#3b82f6'; b.style.marginLeft = '6px'; name.appendChild(b);
    }
    if (nft.badge === 'gold') {
      const b = document.createElement('span'); b.textContent = '★'; b.style.color = '#FFD700'; b.style.marginLeft = '6px'; name.appendChild(b);
    }
    pad.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const owner = nft.owner;
    meta.textContent = `${nft.collection || '—'} • ${owner ? owner.slice(0, 4) + '…' + owner.slice(-4) : '—'}`;
    pad.appendChild(meta);

    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = formatTON(nft.price);
    price.dataset.ton = nft.price; // for USD mirror later
    pad.appendChild(price);

    const buy = document.createElement('button');
    buy.className = 'btn';
    buy.type = 'button';
    buy.textContent = 'Buy Now';
    buy.addEventListener('click', async () => {
      if (!nft.saleAddress) { alert('Sale address missing.'); return; }
      ensureTon();
      try {
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          messages: [{ address: String(nft.saleAddress), amount: toNano(nft.price) }]
        });
      } catch (err) {
        console.warn('TX canceled/failed', err);
      }
    });
    pad.appendChild(buy);

    const view = document.createElement('a');
    view.className = 'btn secondary';
    view.rel = 'nofollow noopener';
    const addr = nft.address || nft.saleAddress || '';
    view.href = `nft.html?address=${encodeURIComponent(addr)}`;
    view.textContent = 'View';
    pad.appendChild(view);

    grid.appendChild(card);
  });

  renderPager(list.length);
  reflectUsdPrices();
}

/* Pagination controls (auto-create #pager after #grid if missing) */
function ensurePagerHost() {
  let pager = document.getElementById('pager');
  if (!pager) {
    pager = document.createElement('div');
    pager.id = 'pager';
    const grid = $('#grid');
    if (grid && grid.parentNode) grid.parentNode.appendChild(pager);
  }
  return pager;
}
function renderPager(total) {
  const pager = ensurePagerHost();
  if (!pager) return;
  pager.textContent = '';

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = clamp(page, 1, pages);

  const mkBtn = (label, target) => {
    const a = document.createElement('a');
    a.className = 'btn secondary';
    a.href = '#';
    a.textContent = label;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (target === page) return;
      page = clamp(target, 1, pages);
      syncUrl();
      renderGrid(filtered);
    });
    return a;
  };

  if (pages <= 1) return;

  pager.appendChild(mkBtn('«', 1));
  pager.appendChild(mkBtn('‹', page - 1));
  const span = document.createElement('span');
  span.className = 'meta';
  span.style.margin = '0 8px';
  span.textContent = `Page ${page} / ${pages}`;
  pager.appendChild(span);
  pager.appendChild(mkBtn('›', page + 1));
  pager.appendChild(mkBtn('»', pages));
}

/* Search & sort (debounced) + URL sync */
function attachToolbar() {
  const search = $('#search');
  const sort = $('#sort');

  if (search) {
    const onSearch = debounce(() => {
      const q = search.value.trim().toLowerCase();
      filtered = allNFTs.filter(n =>
        n.name.toLowerCase().includes(q) ||
        n.collection.toLowerCase().includes(q) ||
        Object.values(n.traits || {}).some(v => safeStr(v).toLowerCase().includes(q))
      );
      page = 1;
      applySort();
      syncUrl();
      renderGrid(filtered);
    }, 200);
    search.addEventListener('input', onSearch);
  }

  if (sort) {
    sort.addEventListener('change', () => {
      applySort();
      page = 1;
      syncUrl();
      renderGrid(filtered);
    });
  }
}

function applySort() {
  const sortVal = $('#sort')?.value || '';
  filtered = stableSort(filtered, (a, b) => {
    if (sortVal === 'price-asc') return (a.price || 0) - (b.price || 0);
    if (sortVal === 'price-desc') return (b.price || 0) - (a.price || 0);
    if (sortVal === 'name') return a.name.localeCompare(b.name);
    if (sortVal === 'newest') return (b.timestamp || 0) - (a.timestamp || 0);
    return 0;
  });
}

/* URL <-> state */
function readUrl() {
  const p = new URLSearchParams(location.search);
  const q = p.get('q') || '';
  const s = p.get('sort') || '';
  page = Number(p.get('page') || '1') || 1;

  if ($('#search')) $('#search').value = q;
  if ($('#sort')) $('#sort').value = s;

  // apply initial filter
  const ql = q.trim().toLowerCase();
  filtered = allNFTs.filter(n =>
    n.name.toLowerCase().includes(ql) ||
    n.collection.toLowerCase().includes(ql) ||
    Object.values(n.traits || {}).some(v => safeStr(v).toLowerCase().includes(ql))
  );
  if (!q) filtered = allNFTs.slice();
  applySort();
}
function syncUrl() {
  const p = new URLSearchParams(location.search);
  if ($('#search')) p.set('q', $('#search').value || '');
  if ($('#sort')) p.set('sort', $('#sort').value || '');
  p.set('page', String(page));
  history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
}

/* Collection stats (optional spans in HTML) */
function renderCollectionStats(list) {
  const owners = new Set(list.map(n => n.owner).filter(Boolean));
  const listed = list.filter(n => n.price > 0);
  const floor = listed.length ? Math.min(...listed.map(n => n.price)) : 0;

  setText('collection-items', String(list.length));
  setText('collection-owners', String(owners.size));
  setText('collection-floor', floor ? formatTON(floor) : '—');
}

/* TON→USD mirror (optional spans in HTML) */
async function reflectUsdPrices() {
  const rate = await getTonUsd();
  if (!rate) return;

  // Per-card mirror
  $$('.price').forEach(el => {
    const ton = Number(el.dataset.ton || 0);
    if (!ton) return;
    const usd = (ton * rate).toFixed(2);
    if (!el.dataset.usdShown) {
      const sub = document.createElement('div');
      sub.className = 'meta';
      sub.textContent = `≈ $${usd}`;
      el.parentElement && el.parentElement.insertBefore(sub, el.nextSibling);
      el.dataset.usdShown = '1';
    } else {
      const next = el.nextElementSibling;
      if (next && next.className === 'meta') next.textContent = `≈ $${usd}`;
    }
  });

  // Page-level placeholders (if exist)
  setText('price-ton-usd', `$${rate.toFixed(3)} / TON`);
}

/* Page inits */
function isPage(id) { return document.body.dataset.page === id; }

async function initHome() {
  await loadNFTs();
  attachToolbar();
  readUrl();
  renderGrid(filtered);
}

async function initProfile() {
  const params = new URLSearchParams(location.search);
  let owner = params.get('address') || localStorage.getItem('rannta_wallet') || '';
  setText('profile-addr', owner || '—');
  await loadNFTs();
  filtered = owner ? allNFTs.filter(n => n.owner === owner) : allNFTs;
  attachToolbar();
  readUrl(); // respects q/sort/page if present
  renderGrid(filtered);
}

async function initCollection() {
  const params = new URLSearchParams(location.search);
  const slug = (params.get('slug') || '').toLowerCase();
  setText('collection-slug', slug || '—');
  await loadNFTs();
  filtered = slug ? allNFTs.filter(n => (n.collection || '').toLowerCase().includes(slug)) : allNFTs;
  renderCollectionStats(filtered);
  attachToolbar();
  readUrl();
  renderGrid(filtered);
}

async function initNFT() {
  const params = new URLSearchParams(location.search);
  const addr = params.get('address');
  if (!addr || !TON_ADDR_RE.test(addr)) {
    const card = $('#nft-card');
    if (card) card.innerHTML = '<div class="meta">Invalid address.</div>';
    return;
  }
  setText('nft-addr', addr);
  await loadNFTs();
  const nft = allNFTs.find(n => n.address === addr || n.saleAddress === addr);
  if (!nft) { const card = $('#nft-card'); if (card) card.innerHTML = '<div class="meta">Not found.</div>'; return; }

  const img = $('#nft-img'); if (img) img.src = nft.image;
  setText('nft-name', nft.name || '—');
  setText('nft-desc', nft.description || '');
  setText('nft-price', formatTON(nft.price));
  setText('nft-collection', nft.collection || '—');
  setText('nft-owner', nft.owner || '—');

  reflectUsdPrices();

  const buy = $('#buy-nft');
  if (buy) {
    buy.addEventListener('click', async () => {
      if (!nft.saleAddress) { alert('Sale address missing.'); return; }
      ensureTon();
      try {
        await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 300,
          messages: [{ address: String(nft.saleAddress), amount: toNano(nft.price) }]
        });
      } catch (e) { console.warn('TX canceled/failed', e); }
    });
  }
}

/* Handlers for header actions (Swap + Connect) */
function attachHeaderActions() {
  const connectBtn = document.getElementById('btn-connect');
  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      ensureTon();
      if (tonConnectUI && typeof tonConnectUI.openModal === 'function') {
        tonConnectUI.openModal();
      } else { alert('TonConnect not loaded.'); }
    });
  }
  const swapBtn = document.getElementById('btn-swap');
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      window.open('https://app.ston.fi/swap?from=TON&to=USDT', '_blank', 'noopener');
    });
  }
}

/* Router */
document.addEventListener('DOMContentLoaded', () => {
  ensureTon();
  attachHeaderActions();

  if (isPage('home')) initHome();
  if (isPage('profile')) initProfile();
  if (isPage('collection')) initCollection();
  if (isPage('nft')) initNFT();
});
