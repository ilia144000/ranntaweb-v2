/* ================= RANNTA ARCA — app.js (all pages connect) ================ */
const TON_MANIFEST_URL = 'https://rannta.com/market/tonconnect-manifest.json';
let tonConnectUI = null;

/* Load TonConnect UI (local → unpkg → jsDelivr) */
async function loadTonConnectUi() {
  const urls = [
    'assets/tonconnect-ui.min.js',
    'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js',
    'https://cdn.jsdelivr.net/npm/@tonconnect/ui@latest/dist/tonconnect-ui.min.js'
  ];
  for (const src of urls) {
    if (window.TON_CONNECT_UI) return true;
    if ([...document.scripts].some(s => s.src.includes(src))) {
      await 0; if (window.TON_CONNECT_UI) return true;
    }
    try {
      await new Promise((ok, err) => {
        const s = document.createElement('script');
        s.src = src; s.async = true; s.onload = ok; s.onerror = () => err(new Error(src));
        document.head.appendChild(s);
      });
      if (window.TON_CONNECT_UI) return true;
    } catch {}
  }
  return false;
}

/* Ensure TonConnect mounted once */
async function ensureTonMounted() {
  if (!window.TON_CONNECT_UI) {
    const ok = await loadTonConnectUi();
    if (!ok) return null;
  }
  if (!tonConnectUI) {
    const host = document.getElementById('tonconnect');
    if (!host) return null;
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({ manifestUrl: TON_MANIFEST_URL });
    tonConnectUI.mount('#tonconnect');

    const update = () => {
      const btn = document.getElementById('btn-connect');
      const acc = tonConnectUI?.account;
      if (acc) {
        const addr = acc.address;
        localStorage.setItem('rannta_wallet', addr);
        if (btn) btn.textContent = 'Connected';
        const nav = document.getElementById('nav-profile');
        if (nav) nav.href = `profile.html?address=${addr}`;
      } else {
        localStorage.removeItem('rannta_wallet');
        if (btn) btn.textContent = 'Connect Wallet';
      }
    };
    tonConnectUI.onStatusChange(update);
    update();
  }
  return tonConnectUI;
}

/* Wire header actions (works on every page) */
function wireHeader() {
  const connectEl = document.getElementById('btn-connect');
  if (connectEl) {
    connectEl.addEventListener('click', async () => {
      const ui = await ensureTonMounted();
      if (ui && typeof ui.openModal === 'function') ui.openModal();
    });
  }
  const swapEl = document.getElementById('btn-swap');
  if (swapEl) {
    swapEl.addEventListener('click', () => {
      // STON.fi (user friendly). اگر خواستی TonSwap: https://tonswap.io/
      window.open('https://app.ston.fi/swap?chartVisible=false', '_blank', 'noopener');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wireHeader();
  // اگر خواستی همیشه آماده باشد، این را باز کن:
  // ensureTonMounted();
});
