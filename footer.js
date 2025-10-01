document.addEventListener("DOMContentLoaded", () => {
  const footer = document.querySelector("footer");
  if (!footer) return;
  footer.innerHTML = `
    <p>
      © 2025 RANNTA. All rights reserved.<br/>
      Forged in fire. Built for the future. — Powered by TON.<br/>
      <span class="footer-line">
        <span class="footer-label">📧 Support:</span>
        <a class="footer-link" href="mailto:support@rannta.com">support@rannta.com</a>
        &nbsp;|&nbsp;
        <span class="footer-label">𝕏 / Twitter:</span>
        <a class="footer-link" href="https://twitter.com/ranntacoin" target="_blank" rel="noopener">@ranntacoin</a>
      </span>
    </p>
  `;
});
