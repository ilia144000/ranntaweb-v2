/* ============ RANNTA ARCA — app.js (Connect / Disconnect with icon) ============ */
const TON_MANIFEST_URL = 'https://rannta.com/market/tonconnect-manifest.json';
let tonConnectUI = null;

/* load TonConnect UI */
async function loadTonConnectUi() {
  const urls = [
    'assets/tonconnect-ui.min.js',
    'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js',
    'https://cdn.jsdelivr.net/npm/@tonconnect/ui@latest/dist/tonconnect-ui.min.js'
  ];
  for (const src of urls) {
    if (window.TON_CONNECT_UI) return true;
    if ([...document.scripts].some(s => s.src.includes(src))) { await 0; if (window.TON_CONNECT_UI) return true; }
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

/* mount TonConnect */
async function ensureTonMounted() {
  if (!window.TON_CONNECT_UI) {
    const ok = await loadTonConnectUi();
    if (!ok) { alert('TonConnect failed to load.'); return null; }
  }
  if (!tonConnectUI) {
    const host = document.getElementById('tonconnect');
    if (!host) return null;
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({ manifestUrl: TON_MANIFEST_URL });
    tonConnectUI.mount('#tonconnect');
    tonConnectUI.onStatusChange(updateConnectButton);
    updateConnectButton();
  }
  return tonConnectUI;
}

/* update button state */
function updateConnectButton() {
  const btn = document.getElementById('btn-connect');
  if (!btn) return;
  const acc = tonConnectUI?.account;
  if (acc) {
    btn.classList.add('connected');
    btn.querySelector('.label').textContent = 'Connected';
  } else {
    btn.classList.remove('connected');
    btn.querySelector('.label').textContent = 'Connect Wallet';
  }
}

/* toggle connect / disconnect */
async function handleConnectClick() {
  const ui = await ensureTonMounted();
  if (!ui) return;
  const acc = ui.account;
  if (acc) {
    await ui.disconnect();
    updateConnectButton();
  } else {
    ui.openModal();
  }
}

/* wire header */
document.addEventListener('DOMContentLoaded', () => {
  const connectEl = document.getElementById('btn-connect');
  if (connectEl) connectEl.addEventListener('click', handleConnectClick);
});
