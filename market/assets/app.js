/* ================= RANNTA ARCA — app.js (robust TonConnect) ================ */
const TON_MANIFEST_URL = 'https://rannta.com/market/tonconnect-manifest.json';

let tonConnectUI = null;

/* Load a script, with multi-source fallback (local → unpkg → jsDelivr) */
async function loadTonConnectUi() {
  const urls = [
    'assets/tonconnect-ui.min.js',
    'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js',
    'https://cdn.jsdelivr.net/npm/@tonconnect/ui@latest/dist/tonconnect-ui.min.js'
  ];

  for (const src of urls) {
    // already loaded?
    if (window.TON_CONNECT_UI) return true;
    if ([...document.scripts].some(s => s.src.includes(src))) {
      await new Promise(r => setTimeout(r, 0));
      if (window.TON_CONNECT_UI) return true;
    }
    try {
      await new Promise((resolve, reject) => {
        const tag = document.createElement('script');
        tag.src = src;
        tag.async = true;
        tag.onload = resolve;
        tag.onerror = () => reject(new Error('Failed: ' + src));
        document.head.appendChild(tag);
      });
      if (window.TON_CONNECT_UI) return true;
    } catch (e) {
      console.warn('[ARCA] Fallback load failed:', src, e);
    }
  }
  return false;
}

/* Make sure TonConnect is ready and mounted */
async function ensureTon() {
  if (!window.TON_CONNECT_UI) {
    const ok = await loadTonConnectUi();
    if (!ok) {
      alert('TonConnect library failed to load.');
      return null;
    }
  }
  if (!tonConnectUI) {
    const host = document.getElementById('tonconnect');
    if (!host) {
      console.error('[ARCA] #tonconnect not found in DOM');
      return null;
    }
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({ manifestUrl: TON_MANIFEST_URL });
    tonConnectUI.mount('#tonconnect');

    // sync wallet → nav + localStorage
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
  return tonConnectUI;
}

/* Header buttons */
function wireHeader() {
  // Connect
  document.querySelectorAll('#btn-connect').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ui = await ensureTon();
      if (ui && typeof ui.openModal === 'function') ui.openModal();
    });
  });

  // Swap → STON.fi
  document.querySelectorAll('#btn-swap').forEach(btn => {
    btn.addEventListener('click', () => {
      window.open('https://app.ston.fi/swap?chartVisible=false', '_blank', 'noopener');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireHeader();
  // اگر دوست داری بدون کلیک هم آماده باشد، این خط را باز کن:
  // ensureTon();
});
