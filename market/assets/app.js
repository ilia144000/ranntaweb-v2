/* ================= RANNTA ARCA — app.js (Connect / Sign / Buy) ================ */
const TON_MANIFEST_URL = 'https://rannta.com/market/tonconnect-manifest.json';

let tonConnectUI = null;

/* --- utils --- */
const toNano = (x) => (BigInt(Math.round(Number(x) * 1e9))).toString();

/* load TonConnect UI (local → CDN fallbacks) */
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

/* ensure TonConnect mounted once */
async function ensureTonMounted() {
  if (!window.TON_CONNECT_UI) {
    const ok = await loadTonConnectUi();
    if (!ok) { alert('TonConnect library failed to load.'); return null; }
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

/* --- actions --- */

/* 1) Connect: just open modal */
async function connectWallet() {
  const ui = await ensureTonMounted();
  if (ui && typeof ui.openModal === 'function') ui.openModal();
}

/* 2) Login(Sign): ask wallet to sign a short text (if supported) */
async function loginSign() {
  const ui = await ensureTonMounted();
  if (!ui) return;
  try {
    const text = `RANNTA ARCA login\nnonce:${Date.now()}`;
    const data = btoa(unescape(encodeURIComponent(text))); // UTF8 → base64

    // low-level connector — some wallets may not support signData
    const connector = ui.connector;
    if (!connector || typeof connector.signData !== 'function') {
      alert('This wallet does not expose Sign via TonConnect.');
      return;
    }
    const res = await connector.signData({ data });
    console.log('[SIGN RESULT]', res);
    alert('Signature requested in wallet. Check console for payload.');
  } catch (e) {
    console.error(e);
    alert('Sign cancelled or failed.');
  }
}

/* 3) Buy: sendTransaction(amount TON → saleAddress) */
async function buyNftByAttrs(el) {
  const ui = await ensureTonMounted();
  if (!ui) return;

  const to = el.getAttribute('data-sale-address');
  const price = Number(el.getAttribute('data-price') || '0');
  if (!to || !price) return alert('Invalid sale data.');

  try {
    const tx = {
      validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
      messages: [{ address: to, amount: toNano(price) }]
    };
    const res = await ui.sendTransaction(tx);
    console.log('[TX RESULT]', res);
    // wallet shows confirmation UI
  } catch (e) {
    console.error('buyNft failed', e);
    alert('Purchase cancelled or failed.');
  }
}

/* wire header + delegated buy buttons */
function wireUI() {
  const connectEl = document.getElementById('btn-connect');
  if (connectEl) connectEl.addEventListener('click', connectWallet);

  const loginEl = document.getElementById('btn-login');
  if (loginEl) loginEl.addEventListener('click', loginSign);

  // delegated handler: any element with [data-buy] will trigger Buy
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-buy]');
    if (t) { ev.preventDefault(); buyNftByAttrs(t); }
  });

  // Swap (حفظ از قبل)
  const swapEl = document.getElementById('btn-swap');
  if (swapEl) {
    swapEl.addEventListener('click', () => {
      window.open('https://app.ston.fi/swap?chartVisible=false', '_blank', 'noopener');
    });
  }
}

document.addEventListener('DOMContentLoaded', wireUI);
