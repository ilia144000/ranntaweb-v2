/* ===================== RANNTA ARCA — app.js ===================== */
const TON_MANIFEST_URL = 'https://rannta.com/market/tonconnect-manifest.json';
const NFT_SRC = 'nfts.json';

let tonConnectUI = null;

/* Init TonConnect */
function initTonConnect() {
  const mountPoint = document.getElementById('tonconnect');
  if (!mountPoint) return;
  if (!window.TON_CONNECT_UI) {
    console.error('[ARCA] tonconnect-ui.min.js not loaded.');
    return;
  }
  if (!tonConnectUI) {
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({ manifestUrl: TON_MANIFEST_URL });
    tonConnectUI.mount('#tonconnect');
    wireWalletState();
  }
}

/* Wallet state sync */
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

/* Hook header buttons */
function hookHeaderButtons() {
  // Connect
  document.querySelectorAll('#btn-connect').forEach(btn => {
    btn.addEventListener('click', () => {
      initTonConnect();
      if (tonConnectUI) tonConnectUI.openModal();
    });
  });

  // Swap → redirect to DEX
  document.querySelectorAll('#btn-swap').forEach(btn => {
    btn.addEventListener('click', () => {
      // هر صرافی DEX روی TON رو میشه گذاشت؛ من DeDust رو گذاشتم
      window.open('https://dedust.io/swap', '_blank');
    });
  });
}

/* Run on every page */
document.addEventListener('DOMContentLoaded', () => {
  initTonConnect();
  hookHeaderButtons();
});
document.addEventListener('DOMContentLoaded', async () => {
  // 1) Init TonConnect
  if (window.TON_CONNECT_UI) {
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
      manifestUrl: 'https://rannta.com/market/tonconnect-manifest.json'
    });
    tonConnectUI.mount('#tonconnect');
  } else {
    console.error('TonConnect UI library not loaded');
  }

  // 2) Button event
  const btn = document.getElementById('btn-connect');
  if (btn) {
    btn.addEventListener('click', () => {
      if (tonConnectUI) {
        tonConnectUI.openModal();
      } else {
        alert('TonConnect not ready. Check console for errors.');
      }
    });
  }
});
