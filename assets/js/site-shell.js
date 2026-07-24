(function () {
  "use strict";

  var HEADER_HTML = ''
    + '<header class="siteHeader">'
    + '  <a class="siteHeader__logoLink" href="/" aria-label="RANNTA Home">'
    + '    <img src="/assets/brand/coin.png?v=2" alt="RANNTA Logo" class="logo" />'
    + '  </a>'
    + '  <div class="siteHeader__brand" aria-label="RANNTA site identity">'
    + '    <div class="site-brand-title">RANNTA — Blockchain Network, Exchange, Encyclopedia &amp; Digital Ecosystem</div>'
    + '    <div class="site-brand-subtitle">One ecosystem for blockchain infrastructure, cross-chain exchange, knowledge and digital creation.</div>'
    + '  </div>'
    + '  <nav class="siteNav" aria-label="Main navigation">'
    + '    <ul class="siteNav__list">'
    + '      <li><a href="/">Home</a></li>'
    + '      <li><a href="/rannta-network.html">RANNTA Network</a></li>'
    + '      <li><a href="/routex.html">RouteX</a></li>'
    + '      <li><a href="/what-is-rannta.html">RANNTA</a></li>'
    + '      <li><a href="/swap.html">Swap RANNTA</a></li>'
    + '      <li><a href="/ranntaverse.html">RANNTAverse</a></li>'
    + '      <li><a href="/articles.html">Articles</a></li>'
    + '      <li><a href="/contact.html">Contact</a></li>'
    + '      <li class="siteNav__more">'
    + '        <details>'
    + '          <summary>More</summary>'
    + '          <div class="siteNav__dropdown">'
    + '            <a href="/gallery.html">Gallery</a>'
    + '            <a href="https://ranntaexchange.com/" target="_blank" rel="noopener noreferrer">RANNTA X-Change</a>'
    + '            <a href="/whitepaper.html">Whitepaper</a>'
    + '            <a href="/roadmap.html">Roadmap</a>'
    + '            <a href="/airdrop.html">Airdrop</a>'
    + '            <a href="/nft.html">NFT Sale</a>'
    + '            <a href="/symbolists.html">Symbolists</a>'
    + '            <a href="/rannta-story.html">About RANNTA</a>'
    + '            <a href="/ai-index.html">RANNTA AI-Index</a>'
    + '            <a href="/team.html">Team</a>'
    + '            <a href="/contracts.html">Contracts</a>'
    + '          </div>'
    + '        </details>'
    + '      </li>'
    + '    </ul>'
    + '  </nav>'
    + '</header>';

  var FOOTER_HTML = ''
    + '<footer class="siteFooter ranntaFooterBar" role="contentinfo" aria-label="Site footer">'
    + '  <div class="siteFooter__inner">'
    + '    <div class="siteFooter__socialRow" aria-label="Official links">'
    + '      <a class="siteFooter__iconLink" href="https://x.com/ranntacoin" target="_blank" rel="noopener" aria-label="X (Twitter)">'
    + '        <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.6l-5.1-6.7L5.6 22H2.5l7.3-8.4L1 2h6.7l4.6 6.1L18.9 2zm-1.2 18h1.8L6.3 3.9H4.4L17.7 20z"></path></svg>'
    + '      </a>'
    + '      <a class="siteFooter__iconLink" href="https://t.me/Rannta_coin" target="_blank" rel="noopener" aria-label="Telegram">'
    + '        <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true"><path d="M22 3.2 2.9 10.8c-1.1.4-1.1 1.9.1 2.3l4.6 1.6 1.8 5.7c.3 1 1.6 1.2 2.2.4l2.9-3.9 5.1 3.7c.8.6 2 .1 2.2-.9L23.7 5c.3-1.5-1.2-2.5-1.7-1.8zM9.2 14.2l10.6-7.3-8.6 9.2-.3 3.7-1.8-5.7z"></path></svg>'
    + '      </a>'
    + '      <a class="siteFooter__iconLink" href="https://www.youtube.com/@ranntacoin" target="_blank" rel="noopener" aria-label="YouTube">'
    + '        <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true"><path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5A3 3 0 0 0 2.4 7.2 31.7 31.7 0 0 0 2 12a31.7 31.7 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 22 12a31.7 31.7 0 0 0-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z"></path></svg>'
    + '      </a>'
    + '      <a class="siteFooter__iconLink" href="https://discord.com/invite/AFWUJEr6nx" target="_blank" rel="noopener" aria-label="Discord">'
    + '        <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true"><path d="M19.5 6.2A14.7 14.7 0 0 0 16 5l-.3.6a13.6 13.6 0 0 0-3.4-.4c-1.1 0-2.3.1-3.4.4L8.6 5A14.7 14.7 0 0 0 5 6.2C3.2 9 2.6 11.7 2.8 14.4c2 1.5 3.9 2.4 5.9 3l.7-1.2c-.7-.3-1.3-.6-1.9-1 0 0 .2-.1.3-.2 3.6 1.7 7.5 1.7 11.1 0 .1.1.3.2.3.2-.6.4-1.2.7-1.9 1l.7 1.2c2-.6 3.9-1.5 5.9-3 .3-2.7-.4-5.4-2.2-8.2zM9.2 13.7c-.7 0-1.2-.7-1.2-1.5s.5-1.5 1.2-1.5 1.2.7 1.2 1.5-.5 1.5-1.2 1.5zm5.6 0c-.7 0-1.2-.7-1.2-1.5s.5-1.5 1.2-1.5 1.2.7 1.2 1.5-.5 1.5-1.2 1.5z"></path></svg>'
    + '      </a>'
    + '      <a class="siteFooter__iconLink" href="https://medium.com/@ranntaofficial" target="_blank" rel="noopener" aria-label="Medium">'
    + '        <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true"><path d="M4 6.5c0-.6.5-1 1-1h.9l4.8 10.8 4.2-10.8H16c.5 0 1 .4 1 1v11c0 .6-.5 1-1 1s-1-.4-1-1V9.6l-3.4 8.9h-.8L6 9.6v7.9c0 .6-.5 1-1 1s-1-.4-1-1v-11z"></path></svg>'
    + '      </a>'
    + '      <a class="siteFooter__iconLink" href="https://github.com/ilia144000" target="_blank" rel="noopener" aria-label="GitHub">'
    + '        <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2.1c-3.2.7-3.9-1.4-3.9-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.9 2.6 3.4 1.9.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.3-5.1-5.8 0-1.3.5-2.4 1.1-3.2-.1-.3-.5-1.5.1-3.1 0 0 .9-.3 3.2 1.1a11 11 0 0 1 5.8 0c2.3-1.4 3.2-1.1 3.2-1.1.6 1.6.2 2.8.1 3.1.7.8 1.1 1.9 1.1 3.2 0 4.5-2.6 5.5-5.1 5.8.4.4.8 1.1.8 2.1v3.1c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .7z"></path></svg>'
    + '      </a>'
    + '    </div>'
    + '    <div class="siteFooter__quickLinks">'
    + '      <a class="siteFooter__textLink" href="https://ranntaexchange.com/" target="_blank" rel="noopener noreferrer"><img class="footerMiniIcon" src="/assets/brand/rannta-x-change.png" alt="" aria-hidden="true" />RANNTA X-Change</a>'
    + '      <span class="siteFooter__dot">•</span>'
    + '      <a class="siteFooter__textLink" href="/routex.html"><img class="footerMiniIcon" src="/assets/brand/routex-gando.webp" alt="" aria-hidden="true" />RouteX</a>'
    + '      <span class="siteFooter__dot">•</span>'
    + '      <a class="siteFooter__textLink" href="https://ranntaverse.app/" target="_blank" rel="noopener"><img class="footerMiniIcon" src="/assets/brand/hub.svg" alt="" aria-hidden="true" />RANNTA Ecosystem Hub</a>'
    + '    </div>'
    + '    <div class="siteFooter__copy">&copy; 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.</div>'
    + '  </div>'
    + '</footer>';

  function addRouteXHomeCard() {
    var currentPath = window.location.pathname || "/";
    if (currentPath !== "/" && currentPath !== "/index.html") return;
    if (document.querySelector("[data-routex-home-card]")) return;

    var anchor = document.querySelector(".home-identity");
    if (!anchor) return;

    var style = document.createElement("style");
    style.textContent = ''
      + '.routexHomeCard{max-width:1180px;margin:28px auto 54px;padding:0 20px;}'
      + '.routexHomeCard__inner{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);overflow:hidden;border:1px solid #26384b;border-radius:22px;background:linear-gradient(145deg,#081019,#101925);box-shadow:0 22px 70px rgba(0,0,0,.28);}'
      + '.routexHomeCard__media{background:#fff;display:flex;align-items:center;justify-content:center;min-height:280px;}'
      + '.routexHomeCard__media img{display:block;width:100%;height:100%;object-fit:contain;}'
      + '.routexHomeCard__copy{padding:34px;display:flex;flex-direction:column;justify-content:center;color:#eef5ff;}'
      + '.routexHomeCard__label{font-size:.75rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#28dfb4;margin-bottom:10px;}'
      + '.routexHomeCard__copy h2{margin:0 0 14px;font-size:clamp(1.8rem,4vw,3rem);}'
      + '.routexHomeCard__copy p{margin:0 0 22px;color:#b9c6d7;line-height:1.75;}'
      + '.routexHomeCard__links{display:flex;flex-wrap:wrap;gap:10px;}'
      + '.routexHomeCard__links a{display:inline-flex;padding:10px 17px;border-radius:10px;text-decoration:none;font-weight:700;background:linear-gradient(135deg,#1bd9aa,#2867e8 58%,#7047e8);color:#fff;}'
      + '.routexHomeCard__links a:last-child{background:transparent;border:1px solid #40536a;color:#dce8f7;}'
      + '@media(max-width:760px){.routexHomeCard__inner{grid-template-columns:1fr}.routexHomeCard__media{min-height:210px}.routexHomeCard__copy{padding:24px}}';
    document.head.appendChild(style);

    var section = document.createElement("section");
    section.className = "routexHomeCard";
    section.setAttribute("data-routex-home-card", "");
    section.setAttribute("aria-labelledby", "routex-home-title");
    section.innerHTML = ''
      + '<div class="routexHomeCard__inner">'
      + '  <a class="routexHomeCard__media" href="/routex.html" aria-label="Discover RouteX">'
      + '    <img src="/assets/brand/routex-gando.webp" width="1280" height="853" alt="RouteX Gando symbol" loading="lazy" />'
      + '  </a>'
      + '  <div class="routexHomeCard__copy">'
      + '    <div class="routexHomeCard__label">RANNTA Native Routing Engine</div>'
      + '    <h2 id="routex-home-title">RouteX</h2>'
      + '    <p>Meet RouteX, the independent cross-chain routing engine being developed by RANNTA for RANNTA X-Change and the RANNTA X-Chain ecosystem. Its Gando symbol represents patience, resilience, precision and protection across every route.</p>'
      + '    <div class="routexHomeCard__links">'
      + '      <a href="/routex.html">Discover RouteX</a>'
      + '      <a href="https://ranntaexchange.com/" target="_blank" rel="noopener noreferrer">Open X-Change</a>'
      + '    </div>'
      + '  </div>'
      + '</div>';

    anchor.insertAdjacentElement("afterend", section);
  }

  function setShell() {
    var headerSlot = document.querySelector("[data-site-header]");
    var footerSlot = document.querySelector("[data-site-footer]");

    if (!headerSlot) {
      headerSlot = document.createElement("div");
      headerSlot.setAttribute("data-site-header", "");
      document.body.insertBefore(headerSlot, document.body.firstChild);
    }

    if (!footerSlot) {
      footerSlot = document.createElement("div");
      footerSlot.setAttribute("data-site-footer", "");
      document.body.appendChild(footerSlot);
    }

    headerSlot.outerHTML = HEADER_HTML;
    footerSlot.outerHTML = FOOTER_HTML;
    addRouteXHomeCard();

    var currentPath = window.location.pathname || "/";
    var links = document.querySelectorAll("header nav a");

    links.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      if ((currentPath === "/" && href === "/") || (href !== "/" && currentPath.endsWith(href))) {
        link.setAttribute("aria-current", "page");
      }
    });

    var moreDetails = document.querySelector(".siteNav__more details");

    if (moreDetails) {
      var moreSummary = moreDetails.querySelector("summary");

      function closeMoreMenu() {
        moreDetails.removeAttribute("open");
        if (moreSummary) {
          moreSummary.setAttribute("aria-expanded", "false");
        }
      }

      function syncMoreState() {
        if (moreSummary) {
          moreSummary.setAttribute("aria-expanded", moreDetails.open ? "true" : "false");
        }
      }

      syncMoreState();
      moreDetails.addEventListener("toggle", syncMoreState);

      document.addEventListener("click", function (event) {
        if (!moreDetails.contains(event.target)) closeMoreMenu();
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeMoreMenu();
      });

      moreDetails.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMoreMenu);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setShell);
  } else {
    setShell();
  }
})();
