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

  var core=document.createElement("script");
  core.src="/assets/js/site-shell-core.js?v=20260724-6";
  core.onload=function(){
    normalizeRanntaTitles();
    setTimeout(normalizeRanntaTitles,50);
  };
  document.head.appendChild(core);
})();