(function(){
  const frame=document.getElementById('site');
  let cssPromise=null;

  function loadCss(){
    if(!cssPromise){
      cssPromise=Promise.all([
        fetch('/assets/css/pq-preview-v4.css',{cache:'no-store'}),
        fetch('/assets/css/pq-preview-v4-fixes.css',{cache:'no-store'})
      ]).then(async responses=>{
        for(const r of responses){if(!r.ok) throw new Error('preview css '+r.status);}
        const parts=await Promise.all(responses.map(r=>r.text()));
        return parts.join('\n\n');
      });
    }
    return cssPromise;
  }

  function classify(doc){
    const body=doc.body;if(!body)return;
    [...body.classList].filter(c=>c.startsWith('pq-')).forEach(c=>body.classList.remove(c));
    const p=(doc.location&&doc.location.pathname)||'/';
    if(p==='/'||p==='/index.html') body.classList.add('pq-home');
    else body.classList.add('pq-simple');
    if(p.endsWith('/swap.html')||p==='/swap.html') body.classList.add('pq-page-swap');
    if(p.endsWith('/team.html')||p==='/team.html') body.classList.add('pq-page-team');
    if(p.endsWith('/ai-index.html')||p==='/ai-index.html') body.classList.add('pq-page-ai');
    if(p.endsWith('/roadmap.html')||p==='/roadmap.html') body.classList.add('pq-page-roadmap');
    if(p.endsWith('/nft.html')||p==='/nft.html') body.classList.add('pq-page-nft');
    if(p.endsWith('/articles.html')||p==='/articles.html') body.classList.add('pq-page-articles');
    if(p.endsWith('/contracts.html')||p==='/contracts.html') body.classList.add('pq-page-contracts');
    if(p.endsWith('/routex.html')||p==='/routex.html') body.classList.add('pq-page-routex');
    if(p.endsWith('/rannta-network.html')||p==='/rannta-network.html') body.classList.add('pq-page-network');
  }

  function markPresaleWarning(doc){
    const root=doc.querySelector('[data-rannta-presale-home]');
    if(!root)return;
    const strongs=[...root.querySelectorAll('strong,b')];
    const warning=strongs.find(el=>/^warning\s*:/i.test((el.textContent||'').trim()));
    if(!warning)return;
    let box=warning.parentElement;
    while(box&&box!==root){
      const t=(box.textContent||'').trim();
      if(t.length>60&&t.length<700){box.classList.add('pq-presale-warning');return;}
      box=box.parentElement;
    }
    warning.parentElement?.classList.add('pq-presale-warning');
  }

  function markLegacyDark(doc){
    const candidates=[...doc.querySelectorAll('section,article,div,a,button')];
    for(const el of candidates){
      if(el.closest('.siteFooter,.ranntaFooterBar,[data-site-footer]')) continue;
      const raw=(el.getAttribute('style')||'').toLowerCase().replace(/\s+/g,'');
      const darkInline=/background(?:-color)?:#(?:000|050505|060606|080808|0a0a0a|0d0d0d|101010|111|111111|121212|131313|171717|181818)|background(?:-color)?:rgb\((?:0|[1-2]?\d),(?:0|[1-2]?\d),(?:0|[1-2]?\d)\)/.test(raw);
      if(darkInline){
        if(el.matches('a,button')) el.classList.add('pq-dark-action');
        else el.classList.add('pq-dark-surface');
      }
    }
  }

  async function skin(){
    try{
      const doc=frame.contentDocument||frame.contentWindow.document;
      if(!doc||!doc.head||!doc.body)return;
      classify(doc);
      markPresaleWarning(doc);
      markLegacyDark(doc);
      const css=await loadCss();
      let style=doc.getElementById('pq-live-reskin-v4');
      if(!style){style=doc.createElement('style');style.id='pq-live-reskin-v4';doc.head.appendChild(style);}
      style.textContent=css;
      doc.documentElement.setAttribute('data-pq-preview','v4.1');
    }catch(e){console.warn('PQ preview skin failed',e);}
  }

  frame.addEventListener('load',()=>{skin();setTimeout(skin,250);setTimeout(skin,900);setTimeout(skin,1800)});
  setTimeout(skin,500);
})();
