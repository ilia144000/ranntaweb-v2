(function(){
  "use strict";

  function normalizeRanntaTitles(){
    var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    var nodes=[];
    var node;
    while((node=walker.nextNode())) nodes.push(node);

    nodes.forEach(function(textNode){
      if(textNode.parentElement&&textNode.parentElement.closest("script,style,textarea,code,pre")) return;
      if(textNode.nodeValue&&textNode.nodeValue.indexOf("RANNTA")!==-1){
        textNode.nodeValue=textNode.nodeValue.replace(/RANNTA\s*—\s*/g,"RANNTA ");
      }
    });

    var title=document.querySelector(".site-brand-title");
    if(title){
      title.innerHTML='<span class="site-brand-rannta">RANNTA</span> Blockchain Network, Exchange, Encyclopedia &amp; Digital Ecosystem';
    }

    if(!document.getElementById("rannta-header-title-fix")){
      var style=document.createElement("style");
      style.id="rannta-header-title-fix";
      style.textContent='.site-brand-title{line-height:1.2}.site-brand-rannta{font-size:1.38em!important;display:inline-block;margin-right:.22em;line-height:.82;vertical-align:baseline}';
      document.head.appendChild(style);
    }
  }

  function surfaceRanntaCore(){
    var navList=document.querySelector(".siteNav__list");
    if(navList&&!navList.querySelector('[data-rannta-core-nav]')){
      var networkLink=navList.querySelector('a[href="/rannta-network.html"]');
      var li=document.createElement("li");
      li.setAttribute("data-rannta-core-nav","");
      li.innerHTML='<a href="/rannta-core.html" style="color:#FFD54A;font-weight:900">RANNTA Core</a>';
      if(networkLink&&networkLink.parentElement&&networkLink.parentElement.nextSibling){
        navList.insertBefore(li,networkLink.parentElement.nextSibling);
      }else{
        navList.appendChild(li);
      }
    }

    var path=window.location.pathname||"/";
    if((path==="/"||path==="/index.html")&&!document.querySelector('[data-rannta-core-home]')){
      var main=document.querySelector("main");
      if(main){
        var section=document.createElement("section");
        section.setAttribute("data-rannta-core-home","");
        section.style.cssText="max-width:1180px;margin:22px auto 36px;padding:0 20px";
        section.innerHTML=''
          + '<div style="border:1px solid rgba(255,213,74,.38);border-radius:22px;padding:26px;background:linear-gradient(145deg,rgba(26,22,8,.98),rgba(10,12,17,.98));box-shadow:0 18px 50px rgba(0,0,0,.28);text-align:center">'
          + '<div style="font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:#FFD54A;font-weight:900;margin-bottom:8px">PUBLIC NODE RELEASE</div>'
          + '<h2 style="margin:0 0 12px;color:#FFD54A;font-size:clamp(1.7rem,4vw,2.5rem)">RANNTA Core v0.1.6</h2>'
          + '<p style="max-width:850px;margin:0 auto 18px;color:#eef1f6;line-height:1.75">Run an independent RANNTA X-Chain Mainnet full node on Windows 10/11. Public node participation is open, and qualified early-node activity is being recorded for the Node Rewards settlement process.</p>'
          + '<div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap">'
          + '<a href="/rannta-core.html" style="display:inline-flex;padding:12px 18px;border-radius:12px;background:#FFD54A;color:#111;font-weight:900;text-decoration:none">RANNTA Core Details</a>'
          + '<a href="https://drive.google.com/drive/folders/1wtAy1Fng8T3QqVEPe5rkZPfzHDbd0_jP?usp=sharing" target="_blank" rel="noopener noreferrer" style="display:inline-flex;padding:12px 18px;border-radius:12px;border:1px solid rgba(255,213,74,.45);color:#fff;font-weight:800;text-decoration:none">Download v0.1.6</a>'
          + '</div></div>';
        main.insertBefore(section,main.firstChild);
      }
    }
  }

  var core=document.createElement("script");
  core.src="/assets/js/site-shell-core.js?v=20260901-1";
  core.onload=function(){
    normalizeRanntaTitles();
    surfaceRanntaCore();
    setTimeout(function(){normalizeRanntaTitles();surfaceRanntaCore();},50);
  };
  document.head.appendChild(core);
})();