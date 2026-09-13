(function(){
  'use strict';

  function ensureStyles(){
    if(document.getElementById('rannta-theme-2026-css')) return;
    var link=document.createElement('link');
    link.id='rannta-theme-2026-css';
    link.rel='stylesheet';
    link.href='/assets/css/rannta-theme-2026.css?v=20260913';
    document.head.appendChild(link);
  }

  function classify(){
    var body=document.body;if(!body)return;
    Array.from(body.classList).filter(function(c){return c.indexOf('pq-')===0;}).forEach(function(c){body.classList.remove(c);});
    var p=window.location.pathname||'/';
    if(p==='/'||p==='/index.html') body.classList.add('pq-home');
    else body.classList.add('pq-simple');
    if(p==='/swap.html'||p.endsWith('/swap.html')) body.classList.add('pq-page-swap');
    if(p==='/team.html'||p.endsWith('/team.html')) body.classList.add('pq-page-team');
    if(p==='/ai-index.html'||p.endsWith('/ai-index.html')) body.classList.add('pq-page-ai');
    if(p==='/roadmap.html'||p.endsWith('/roadmap.html')) body.classList.add('pq-page-roadmap');
    if(p==='/nft.html'||p.endsWith('/nft.html')) body.classList.add('pq-page-nft');
    if(p==='/articles.html'||p.endsWith('/articles.html')) body.classList.add('pq-page-articles');
    if(p==='/contracts.html'||p.endsWith('/contracts.html')) body.classList.add('pq-page-contracts');
    if(p==='/routex.html'||p.endsWith('/routex.html')) body.classList.add('pq-page-routex');
    if(p==='/rannta-network.html'||p.endsWith('/rannta-network.html')) body.classList.add('pq-page-network');
    if(p==='/rannta-core.html'||p.endsWith('/rannta-core.html')) body.classList.add('pq-page-core');
  }

  function markPresaleWarning(){
    var root=document.querySelector('[data-rannta-presale-home]');
    if(!root)return;
    var warning=Array.from(root.querySelectorAll('strong,b')).find(function(el){return /^warning\s*:/i.test((el.textContent||'').trim());});
    if(!warning)return;
    var box=warning.parentElement;
    while(box&&box!==root){
      var t=(box.textContent||'').trim();
      if(t.length>60&&t.length<700){box.classList.add('pq-presale-warning');return;}
      box=box.parentElement;
    }
    if(warning.parentElement) warning.parentElement.classList.add('pq-presale-warning');
  }

  function markLegacyDark(){
    var nodes=document.querySelectorAll('section,article,div,a,button');
    nodes.forEach(function(el){
      if(el.closest('.siteFooter,.ranntaFooterBar,[data-site-footer]')) return;
      var raw=(el.getAttribute('style')||'').toLowerCase().replace(/\s+/g,'');
      var dark=/background(?:-color)?:#(?:000|050505|060606|080808|0a0a0a|0d0d0d|101010|111|111111|121212|131313|171717|181818)|background(?:-color)?:rgb\((?:0|[1-2]?\d),(?:0|[1-2]?\d),(?:0|[1-2]?\d)\)/.test(raw);
      if(dark){
        if(el.matches('a,button')) el.classList.add('pq-dark-action');
        else el.classList.add('pq-dark-surface');
      }
    });
  }

  function apply(){
    ensureStyles();
    classify();
    markPresaleWarning();
    markLegacyDark();
    document.documentElement.setAttribute('data-rannta-theme','2026');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply);
  else apply();

  setTimeout(apply,250);
  setTimeout(apply,900);
  setTimeout(apply,1800);

  var observer=new MutationObserver(function(){
    clearTimeout(observer._t);
    observer._t=setTimeout(function(){markPresaleWarning();markLegacyDark();},80);
  });
  if(document.documentElement) observer.observe(document.documentElement,{childList:true,subtree:true});
})();
