// Google Analytics 4 bootstrap for RANNTA
// Measurement ID: G-LQFLPTE6QS
(function () {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-LQFLPTE6QS';
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };

  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'granted',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  gtag('js', new Date());
  gtag('config', 'G-LQFLPTE6QS', { transport_type: 'beacon' });

  // Optional: useful auto-events
  function trackEvent(name, params){ if (typeof gtag==='function') gtag('event', name, params||{}); }

  // Outbound links
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    if (a.host && a.host !== location.host) {
      trackEvent('click_outbound', {
        link_url: a.href,
        link_text: (a.textContent || '').trim().slice(0,80),
        link_domain: a.host
      });
    }
  });

  // File downloads
  var exts = ['.pdf','.zip','.rar','.7z','.csv','.xlsx','.pptx','.docx','.mp4','.mp3','.apk'];
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var url = a.href.toLowerCase();
    var hit = exts.find(function (ext){ return url.endsWith(ext); });
    if (hit) trackEvent('file_download', { file_url: a.href, file_ext: hit.slice(1) });
  });

  // CTA by attributes
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-analytics]');
    if (!el) return;
    var name = el.getAttribute('data-analytics') || 'cta_click';
    var label = el.getAttribute('data-label') || (el.textContent || '').trim().slice(0,80);
    trackEvent(name, { label: label });
  });
})();
