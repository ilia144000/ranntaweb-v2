/* ============ RANNTA ARCA — app.js (connect + sign + disconnect + buy) ============ */
const TON_MANIFEST_URL = 'https://rannta.com/market/tonconnect-manifest.json';
const AUTH_BASE = '/api'; // اگر بک‌اند را پشت /api پروکسی کردی. اگر نداری، مشکلی نیست؛ امضای fallback اجرا می‌شود.

let tonConnectUI = null;
let sessionToken = null;

/* ---- helpers ---- */
const toNano = (x) => (BigInt(Math.round(Number(x) * 1e9))).toString();
const api = (p, opt={}) => fetch(`${AUTH_BASE}${p}`, {
  headers: { 'Content-Type':'application/json', ...(sessionToken?{Authorization:`Bearer ${sessionToken}`}:{}) },
  ...opt
}).then(r => r.json());

const once = (fn) => { let done=false; return (...a)=>done?undefined:(done=true,fn(...a)); };

/* load TonConnect UI (local → CDN fallbacks) */
async function loadTonConnectUi() {
  const srcs = [
    'assets/tonconnect-ui.min.js',
    'https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js',
    'https://cdn.jsdelivr.net/npm/@tonconnect/ui@latest/dist/tonconnect-ui.min.js'
  ];
  for (const src of srcs) {
    if (window.TON_CONNECT_UI) return true;
    if ([...document.scripts].some(s => s.src.includes(src))) { await 0; if (window.TON_CONNECT_UI) return true; }
    try {
      await new Promise((ok, err) => {
        const s = document.createElement('script');
        s.src = src; s.async = true; s.onload = ok; s.onerror = () => err(new Error('load fail '+src));
        document.head.appendChild(s);
      });
      if (window.TON_CONNECT_UI) return true;
    } catch {}
  }
  return false;
}

/* mount TonConnect once */
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
    tonConnectUI.onStatusChange(handleWalletStatus);
    handleWalletStatus();
  }
  return tonConnectUI;
}

/* elements */
function els(){
  return {
    connectBtn: document.getElementById('btn-connect'),
    disconnectBtn: document.getElementById('btn-disconnect'),
    swapBtn: document.getElementById('btn-swap'),
    label: document.querySelector('#btn-connect .label'),
    navProfile: document.getElementById('nav-profile'),
  };
}

/* update UI by wallet state */
function handleWalletStatus() {
  const { connectBtn, disconnectBtn, label, navProfile } = els();
  const acc = tonConnectUI?.account;

  if (acc) {
    if (label) label.textContent = 'Connected';
    if (connectBtn) connectBtn.classList.add('connected');
    if (disconnectBtn) disconnectBtn.classList.remove('hidden');
    localStorage.setItem('rannta_wallet', acc.address);
    if (navProfile) navProfile.href = `profile.html?address=${acc.address}`;
    // پس از اتصال، یکبار امضا بخواه (حتی اگر سرور نباشد)
    requestSignAfterConnectOnce();
  } else {
    if (label) label.textContent = 'Connect Wallet';
    if (connectBtn) connectBtn.classList.remove('connected');
    if (disconnectBtn) disconnectBtn.classList.add('hidden');
    localStorage.removeItem('rannta_wallet');
    sessionToken = null;
  }
}

/* ---- SIGN: prefer challenge from server; else fallback to simple sign ---- */
const requestSignAfterConnectOnce = once(async function requestSignAfterConnectOnce() {
  const acc = tonConnectUI?.account;
  const connector = tonConnectUI?.connector;
  if (!acc || !connector) return;

  // 1) تلاش برای گرفتن چلنج از سرور
  let nonce, useFallback = false;
  try {
    const ch = await api('/auth/challenge');
    if (ch?.nonce) nonce = ch.nonce; else useFallback = true;
  } catch {
    useFallback = true;
  }

  // 2) متن برای امضا (با سرور هماهنگ باشد)
  const prefix = 'RANNTA ARCA login';
  const text = useFallback
    ? `${prefix}\nnonce:${Date.now()}` // fallback: فقط برای نمایش پاپ‌آپ
    : `${prefix}\nnonce:${nonce}`;

  try {
    if (typeof connector.signData !== 'function') {
      console.warn('Wallet does not expose signData via TonConnect.');
      return;
    }
    const data = btoa(unescape(encodeURIComponent(text))); // UTF-8 → base64
    const res = await connector.signData({ data });        // کیف پول پاپ‌آپ امضا را نشان می‌دهد
    const sigB64 = res?.signature;

    // 3) اگر سرور داریم، امضا را برای تأیید بفرستیم تا توکن جلسه بدهد
    if (!useFallback && sigB64) {
      try {
        const vr = await api('/auth/verify', {
          method: 'POST',
          body: JSON.stringify({
            address: acc.address,
            publicKey: acc.publicKey,  // hex ed25519
            nonce,
            signature: sigB64,
            prefix
          })
        });
        if (vr?.ok && vr.token) {
          sessionToken = vr.token;
          console.log('[LOGIN OK]', vr);
        } else {
          console.warn('Login verify failed', vr);
        }
      } catch (e) {
        console.warn('Verify request failed', e);
      }
    }
  } catch (e) {
    console.warn('Sign request cancelled or failed', e);
  }
});

/* ---- header actions ---- */
async function onClickConnect() {
  const ui = await ensureTonMounted();
  if (!ui) return;
  if (ui.account) return; // وصل است؛ برای قطع از دکمه Disconnect استفاده کند
  ui.openModal();         // مودال اتصال
}

async function onClickDisconnect() {
  const ui = await ensureTonMounted();
  if (!ui) return;
  try {
    await ui.disconnect();
    handleWalletStatus();
  } catch (e) {
    console.error('Disconnect failed', e);
  }
}

/* ---- Buy via data attributes ---- */
async function buyNftByAttrs(el) {
  const ui = await ensureTonMounted();
  if (!ui) return;
  if (!ui.account) { await onClickConnect(); return; }

  const to = el.getAttribute('data-sale-address');
  const price = Number(el.getAttribute('data-price') || '0');
  if (!to || !price) return alert('Invalid sale data.');

  try {
    const tx = {
      validUntil: Math.floor(Date.now()/1000) + 5*60,
      messages: [{ address: to, amount: toNano(price) }]
    };
    const res = await ui.sendTransaction(tx); // پاپ‌آپ تراکنش
    console.log('[TX RESULT]', res);
  } catch (e) {
    console.error('buyNft failed', e);
    alert('Purchase cancelled or failed.');
  }
}

/* ---- wire everything on every page ---- */
function wireUI() {
  const { connectBtn, disconnectBtn, swapBtn } = els();
  if (connectBtn) connectBtn.addEventListener('click', onClickConnect);
  if (disconnectBtn) disconnectBtn.addEventListener('click', onClickDisconnect);
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      window.open('https://app.ston.fi/swap?chartVisible=false', '_blank', 'noopener');
    });
  }

  // Delegate Buy buttons: any element with [data-buy]
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-buy]');
    if (t) { e.preventDefault(); buyNftByAttrs(t); }
  });
}

document.addEventListener('DOMContentLoaded', wireUI);
/* ====== RANNTA ARCA — Deploy helpers (append at file end) ====== */

/** تنظیمات تخمینی هزینه‌ها (TON) — ساده و شفاف */
const ARCA_FEE_EST = {
  deployMin: 0.05,
  deployMax: 0.20,
  safety: 0.02,   // حاشیه اطمینان
};

/** آدرس فکتوری شما برای دیپلوی کالکشن — حتماً جایگزین کن! */
const COLLECTION_FACTORY = 'EQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; 
// TODO: آدرس واقعی Factory/Deployer قرارداد خودت را بگذار.

/** برآورد هزینه‌ی دیپلوی (الان فقط دیپلوی؛ مینتِ آتی جداست) */
function estimateDeployCostTon(supply) {
  // می‌تونی هوشمندترش کنی، فعلاً ساده: سقف + safety
  return +(ARCA_FEE_EST.deployMax + ARCA_FEE_EST.safety).toFixed(3);
}

/** خروجی برای استفاده در صفحات */
window.arcaEstimateDeploy = estimateDeployCostTon;

/** دیپلوی کالکشن: کیف پول را باز می‌کند (Transfer به Factory) */
window.arcaDeployCollection = async function(payload) {
  // payload: { name, slug, supply, priceTon, royaltyPct, royaltyAddr }
  const ui = await ensureTonMounted();
  if (!ui) { alert('TonConnect not ready.'); return; }
  if (!ui.account) { await onClickConnect(); return; }

  if (!COLLECTION_FACTORY || !/^E[Q|U]/.test(COLLECTION_FACTORY)) {
    alert('Factory address is not set. Please configure COLLECTION_FACTORY in app.js');
    return;
  }

  const amountTon = estimateDeployCostTon(payload?.supply || 0);

  // نکته: در فاز بعدی، payload/stateInit را اضافه می‌کنیم تا Factory بداند چه دیپلوی کند.
  const tx = {
    validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
    messages: [{
      address: COLLECTION_FACTORY,
      amount: toNano(amountTon),
      // payload: <base64 BOC>  // آینده: برای پاس‌دادن name/slug/royalty و ...
    }]
  };

  try {
    const res = await ui.sendTransaction(tx);
    console.log('[DEPLOY_TX]', res);
    alert('Transaction sent. Confirm in your wallet.\n(Factory will deploy the collection.)');
  } catch (e) {
    console.warn('Deploy cancelled/failed:', e);
    alert('Deploy cancelled or failed.');
  }
};
