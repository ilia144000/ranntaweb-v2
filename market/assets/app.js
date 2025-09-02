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

/* NEW: hook connect button */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-connect');
  if (btn) {
    btn.addEventListener('click', () => {
      ensureTon();
      if (tonConnectUI) tonConnectUI.openModal();
    });
  }
});

/* -------- NFT loading + rendering (کد اصلی پایینش همونه) -------- */
// loadNFTs(), renderGrid(), search/sort, pagination … (بدون تغییر)
