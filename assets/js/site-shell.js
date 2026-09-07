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

  function surfacePresale(){
    var path=window.location.pathname||"/";
    if(path!=="/"&&path!=="/index.html") return;
    if(document.querySelector('[data-rannta-presale-home]')) return;

    var anchor=document.querySelector('.home-identity');
    if(!anchor) return;

    var section=document.createElement('section');
    section.setAttribute('data-rannta-presale-home','');
    section.style.cssText='max-width:1180px;margin:22px auto 8px;padding:0 20px;box-sizing:border-box';
    section.innerHTML=''
      + '<div style="position:relative;overflow:hidden;border:1px solid rgba(255,213,74,.52);border-radius:22px;padding:24px 26px;background:linear-gradient(135deg,rgba(34,26,5,.98),rgba(10,12,18,.99));box-shadow:0 18px 55px rgba(0,0,0,.32);text-align:center">'
      + '<div style="font-size:.76rem;letter-spacing:.16em;text-transform:uppercase;color:#FFD54A;font-weight:900;margin-bottom:8px">OFFICIAL RANNTA SALE - TON MAINNET</div>'
      + '<h2 style="margin:0 0 10px;color:#fff;font-size:clamp(1.55rem,4vw,2.35rem)">Official RANNTA Presale V2 on TON Mainnet Is Live</h2>'
      + '<p style="max-width:900px;margin:0 auto 15px;color:#e9edf3;line-height:1.72">Purchase the official RANNTA Jetton on The Open Network (TON) through the active Presale V2 Mainnet contract. This sale is for the TON-based RANNTA token and is separate from RANNTA X-Chain and its native asset RNTX.</p>'
      + '<div style="display:flex;justify-content:center;gap:8px 16px;flex-wrap:wrap;margin:0 0 18px;color:#cfd5de;font-size:.9rem"><span>TON Mainnet</span><span>•</span><span>Presale V2</span><span>•</span><span>On-chain delivery</span><span>•</span><span>Separate from RANNTA X-Chain</span></div>'
      + '<div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap">'
      + '<a href="https://presale.rannta.com/" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:12px 20px;border-radius:12px;background:#FFD54A;color:#111;font-weight:900;text-decoration:none">Open Official Sale</a>'
      + '<a href="https://tonviewer.com/EQBCY5Yj9G6VAQibTe6hz53j8vBNO234n0fzHUP3lUBBYbeR" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:12px 20px;border-radius:12px;border:1px solid rgba(255,213,74,.46);color:#fff;font-weight:800;text-decoration:none">Verify RANNTA Jetton</a>'
      + '</div>'
      + '<div style="margin-top:15px;color:#c6ccd5;font-size:.8rem;font-weight:700;word-break:break-all">Jetton Master: EQBCY5Yj9G6VAQibTe6hz53j8vBNO234n0fzHUP3lUBBYbeR</div>'
      + '<div style="max-width:960px;margin:16px auto 0;padding:13px 15px;border:1px solid rgba(255,64,64,.58);border-radius:12px;background:rgba(120,0,0,.20);color:#ffd4d4;font-size:.9rem;font-weight:700;line-height:1.65"><strong style="color:#ff3b3b;font-size:1.06rem;font-weight:900">Warning:</strong> The only official RANNTA Coin is on TON. Any RANNTA token on Solana, Ethereum, BNB Chain, Base, or any other network is fake and not affiliated with the official RANNTA project.</div>'
      + '</div>';

    anchor.parentNode.insertBefore(section,anchor);
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
    surfacePresale();
    surfaceRanntaCore();
    setTimeout(function(){normalizeRanntaTitles();surfacePresale();surfaceRanntaCore();},50);
  };
  document.head.appendChild(core);
})();