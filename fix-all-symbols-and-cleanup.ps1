# ============================================================
# RANNTA WEB v2 - COMPREHENSIVE FIX SCRIPT
# Fixes: broken symbols, spurious list items, header/footer
# ============================================================

Write-Host "=== RANNTA Web v2 - Comprehensive Fix Script ===" -ForegroundColor Cyan
Write-Host ""

# --- FIX 1: Update footer.html (master template) ---
Write-Host "[1/6] Updating footer.html master template..." -ForegroundColor Yellow
$footerPath = "C:\ranntaweb-v2\footer.html"
$footerContent = Get-Content $footerPath -Raw
$footerContent = $footerContent -replace 'class="siteFooter__dot">\?\?\?</', 'class="siteFooter__dot">•</'
$footerContent = $footerContent -replace '\?\? 2025', '© 2025'
$footerContent | Out-File $footerPath -Encoding ascii -Force
Write-Host "  -> footer.html fixed" -ForegroundColor Green

# --- FIX 2: Neutralize footer.js ---
Write-Host "[2/6] Updating footer.js (neutralizing old code)..." -ForegroundColor Yellow
@"
// footer.js - Neutralized. Footer is now injected via HTML template.
// See footer.html for the canonical footer snippet.
"@ | Out-File "C:\ranntaweb-v2\footer.js" -Encoding ascii -Force
Write-Host "  -> footer.js neutralized" -ForegroundColor Green

# --- FIX 3: Fix broken symbols in all HTML files ---
Write-Host "[3/6] Fixing broken symbols (??? / ?? ) in all HTML files..." -ForegroundColor Yellow

# Get all HTML files
$htmlFiles = Get-ChildItem -Path "C:\ranntaweb-v2" -Filter "*.html" -Recurse

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    $changed = $false
    
    # Fix 3a: Replace "???" in siteFooter__dot with "•" (bullet)
    if ($content -match 'class="siteFooter__dot">\?\?\?<') {
        $content = $content -replace 'class="siteFooter__dot">\?\?\?</', 'class="siteFooter__dot">•</'
        $changed = $true
    }
    
    # Fix 3b: Replace "???" in footer__dot (rannta.html uses this class)
    if ($content -match 'class="footer__dot">\?\?\?<') {
        $content = $content -replace 'class="footer__dot">\?\?\?</', 'class="footer__dot">•</'
        $changed = $true
    }
    
    # Fix 3c: Replace "???" in site-footer__dot (entity.html uses this class)
    if ($content -match 'class="site-footer__dot">\?\?\?<') {
        $content = $content -replace 'class="site-footer__dot">\?\?\?</', 'class="site-footer__dot">•</'
        $changed = $true
    }
    
    # Fix 3d: Replace "??" in copyright line with "©"
    if ($content -match '\?\? 2025' -or $content -match '\?\? 2026') {
        $content = $content -replace '\?\? 2025', '© 2025'
        $content = $content -replace '\?\? 2026', '© 2026'
        $changed = $true
    }
    
    # Fix 3e: Fix other broken unicode characters in titles/text (ranta-coin.html has ??? in title)
    if ($content -match 'RANNTA Coin \?\?\?') {
        $content = $content -replace 'RANNTA Coin \?\?\?', 'RANNTA Coin —'
        $changed = $true
    }
    if ($content -match 'RANNTA Coin \?\?\? Official') {
        $content = $content -replace 'RANNTA Coin \?\?\? Official', 'RANNTA Coin — Official'
        $changed = $true
    }
    if ($content -match 'why people search for \?\?\?RANNTA coin\?\?\?') {
        $content = $content -replace 'why people search for \?\?\?RANNTA coin\?\?\?', 'why people search for RANNTA coin'
        $changed = $true
    }
    
    # Fix 3f: Fix "??(c)" patterns  
    $content = $content -replace '\?\?\(c\)', '©'
    
    # Write back if changed
    if ($changed) {
        $content | Out-File $file.FullName -Encoding ascii -Force
        Write-Host "  -> Fixed symbols in $($file.Name)" -ForegroundColor Green
    }
}

# --- FIX 4: Remove spurious <li> items (useless decorative list items) ---
Write-Host "[4/6] Removing spurious/useless <li> items from lists..." -ForegroundColor Yellow

# Define the pattern for spurious list items (the decorative RANNTA Network link at top of lists)
# These are <li><a href="network-launch.html" style="color: #EAB308; font-weight: bold;">RANNTA Network</a></li>
$spuriousPattern = '<li>\s*<a href="network-launch\.html" style="color: #EAB308; font-weight: bold;">RANNTA Network</a>\s*</li>'

# Files known to have these spurious items
$filesWithSpurious = @(
    "C:\ranntaweb-v2\contact.html",
    "C:\ranntaweb-v2\contracts.html",
    "C:\ranntaweb-v2\whitepaper.html",
    "C:\ranntaweb-v2\roadmap.html",
    "C:\ranntaweb-v2\burn.html",
    "C:\ranntaweb-v2\articles.html",
    "C:\ranntaweb-v2\manifesto.html",
    "C:\ranntaweb-v2\nft.html",
    "C:\ranntaweb-v2\swap.html",
    "C:\ranntaweb-v2\signal-13.html",
    "C:\ranntaweb-v2\rannta-story.html",
    "C:\ranntaweb-v2\what-is-rannta.html",
    "C:\ranntaweb-v2\architect\code-il144k.html",
    "C:\ranntaweb-v2\architect\declaration-il144k.html",
    "C:\ranntaweb-v2\ranta-coin.html"
)

foreach ($filePath in $filesWithSpurious) {
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        $original = $content
        
        # Remove ALL occurrences of the spurious list item pattern
        $content = $content -replace $spuriousPattern, ''
        
        # Also remove any bare leftover empty <li></li> from within <ul> blocks
        # But be careful not to break real empty list items
        $content = $content -replace '(?s)<li>\s*</li>', ''
        
        if ($content -ne $original) {
            $content | Out-File $filePath -Encoding ascii -Force
            Write-Host "  -> Removed spurious items from $([System.IO.Path]::GetFileName($filePath))" -ForegroundColor Green
        }
    }
}

# --- FIX 5: Replace inline headers with unified header in special pages ---
Write-Host "[5/6] Replacing inline headers in special pages..." -ForegroundColor Yellow

# The unified header template (from index.html)
$unifiedHeader = @"
  <header>
    <img src="assets/brand/coin.png?v=2" alt="RANNTA Logo" class="logo" />
    <nav>
      <ul>
                <li><a href="network-launch.html" style="color: #EAB308; font-weight: bold;">RANNTA Network</a></li>
        <li><a href="index.html">Home</a></li>
        <li><a href="articles.html">Articles</a></li>
        <li><a href="gallery.html">Gallery</a></li>
        <li><a href="whitepaper.html">Whitepaper</a></li>
        <li><a href="roadmap.html">Roadmap</a></li>
        <li><a href="airdrop.html">Airdrop</a></li>
        <li><a href="nft.html">NFT Sale</a></li>
        <li><a href="symbolists.html">Symbolists</a></li>
        <li><a href="what-is-rannta.html">RANNTA</a></li>
        <li><a href="ranntaverse.html">RANNTAverse</a></li>
        <li><a href="rannta-story.html">About RANNTA</a></li>
        <li><a href="contact.html">Contact</a></li>
        <li><a href="rannta.html">RANNTA AI-Index</a></li>
        <li><a href="team.html">Team</a></li>
        <li><a href="contracts.html">Contracts</a></li>
      </ul>
    </nav>
  </header>
"@

# The unified footer template (from index.html)
$unifiedFooter = @"
  <footer class="siteFooter ranntaFooterBar" role="contentinfo" aria-label="Site footer">
    <div class="siteFooter__inner">

      <div class="siteFooter__socialRow" aria-label="Official links">
        <a class="siteFooter__iconLink" href="https://x.com/ranntacoin" target="_blank" rel="noopener" aria-label="X (Twitter)">
          <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true">
            <path d="M18.9 2H22l-6.8 7.8L23 22h-6.6l-5.1-6.7L5.6 22H2.5l7.3-8.4L1 2h6.7l4.6 6.1L18.9 2zm-1.2 18h1.8L6.3 3.9H4.4L17.7 20z"></path>
          </svg>
        </a>

        <a class="siteFooter__iconLink" href="https://t.me/Rannta_coin" target="_blank" rel="noopener" aria-label="Telegram">
          <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true">
            <path d="M22 3.2 2.9 10.8c-1.1.4-1.1 1.9.1 2.3l4.6 1.6 1.8 5.7c.3 1 1.6 1.2 2.2.4l2.9-3.9 5.1 3.7c.8.6 2 .1 2.2-.9L23.7 5c.3-1.5-1.2-2.5-1.7-1.8zM9.2 14.2l10.6-7.3-8.6 9.2-.3 3.7-1.8-5.7z"></path>
          </svg>
        </a>

        <a class="siteFooter__iconLink" href="https://www.youtube.com/@ranntacoin" target="_blank" rel="noopener" aria-label="YouTube">
          <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true">
            <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5A3 3 0 0 0 2.4 7.2 31.7 31.7 0 0 0 2 12a31.7 31.7 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1A31.7 31.7 0 0 0 22 12a31.7 31.7 0 0 0-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z"></path>
          </svg>
        </a>

        <a class="siteFooter__iconLink" href="https://discord.com/invite/AFWUJEr6nx" target="_blank" rel="noopener" aria-label="Discord">
          <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true">
            <path d="M19.5 6.2A14.7 14.7 0 0 0 16 5l-.3.6a13.6 13.6 0 0 0-3.4-.4c-1.1 0-2.3.1-3.4.4L8.6 5A14.7 14.7 0 0 0 5 6.2C3.2 9 2.6 11.7 2.8 14.4c2 1.5 3.9 2.4 5.9 3l.7-1.2c-.7-.3-1.3-.6-1.9-1 0 0 .2-.1.3-.2 3.6 1.7 7.5 1.7 11.1 0 .1.1.3.2.3.2-.6.4-1.2.7-1.9 1l.7 1.2c2-.6 3.9-1.5 5.9-3 .3-2.7-.4-5.4-2.2-8.2zM9.2 13.7c-.7 0-1.2-.7-1.2-1.5s.5-1.5 1.2-1.5 1.2.7 1.2 1.5-.5 1.5-1.2 1.5zm5.6 0c-.7 0-1.2-.7-1.2-1.5s.5-1.5 1.2-1.5 1.2.7 1.2 1.5-.5 1.5-1.2 1.5z"></path>
          </svg>
        </a>

        <a class="siteFooter__iconLink" href="https://medium.com/@ranntaofficial" target="_blank" rel="noopener" aria-label="Medium">
          <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true">
            <path d="M4 6.5c0-.6.5-1 1-1h.9l4.8 10.8 4.2-10.8H16c.5 0 1 .4 1 1v11c0 .6-.5 1-1 1s-1-.4-1-1V9.6l-3.4 8.9h-.8L6 9.6v7.9c0 .6-.5 1-1 1s-1-.4-1-1v-11z"></path>
          </svg>
        </a>

        <a class="siteFooter__iconLink" href="https://github.com/ilia144000" target="_blank" rel="noopener" aria-label="GitHub">
          <svg viewBox="0 0 24 24" class="siteFooter__icon" aria-hidden="true">
            <path d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2.1c-3.2.7-3.9-1.4-3.9-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.9 2.6 3.4 1.9.1-.7.4-1.2.7-1.5-2.5-.3-5.1-1.3-5.1-5.8 0-1.3.5-2.4 1.1-3.2-.1-.3-.5-1.5.1-3.1 0 0 .9-.3 3.2 1.1a11 11 0 0 1 5.8 0c2.3-1.4 3.2-1.1 3.2-1.1.6 1.6.2 2.8.1 3.1.7.8 1.1 1.9 1.1 3.2 0 4.5-2.6 5.5-5.1 5.8.4.4.8 1.1.8 2.1v3.1c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .7z"></path>
          </svg>
        </a>
      </div>

      <div class="siteFooter__quickLinks">
        <a class="siteFooter__textLink" href="https://ranntaverse.art/" target="_blank" rel="noopener"><img class="footerMiniIcon" src="assets/brand/store.svg" alt="" aria-hidden="true" />
          RANNTAverse Store
        </a>

        <span class="siteFooter__dot">•</span>

        <a class="siteFooter__textLink" href="https://ranntaverse.app/" target="_blank" rel="noopener"><img class="footerMiniIcon" src="assets/brand/hub.svg" alt="" aria-hidden="true" />
          RANNTA Ecosystem Hub
        </a>
      </div>

      <div class="siteFooter__copy">© 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.</div>
    </div>
  </footer>
"@

# Function to replace header and footer using regex
function Replace-HeaderFooter {
    param($FilePath, $NewHeader, $NewFooter)
    
    $content = Get-Content $FilePath -Raw
    $original = $content
    
    # Replace the header (between <body> and the next opening tag that isn't part of header/nav)
    # Match from <header...> until </header>
    $content = $content -replace '(?s)<header[^>]*>.*?</header>', $NewHeader
    
    # Replace the footer
    # Match from <footer...> until </footer>  
    $content = $content -replace '(?s)<footer[^>]*>.*?</footer>', $NewFooter
    
    if ($content -ne $original) {
        $content | Out-File $FilePath -Encoding ascii -Force
        return $true
    }
    return $false
}

# === 5a: 404.html ===
$path404 = "C:\ranntaweb-v2\404.html"
$content404 = Get-Content $path404 -Raw

# 404.html has a custom inline header (style="padding: 40px 0; text-align: center;")
# and a custom inline footer (style="padding: 60px 20px; text-align: center;")
# Replace them with unified versions (using proper classes)
$header404 = @"
    $unifiedHeader
"@
$footer404 = @"
    $unifiedFooter
"@
$content404 = $content404 -replace '(?s)<header[^>]*>.*?</header>', $header404
$content404 = $content404 -replace '(?s)<footer[^>]*>.*?</footer>', $footer404
# Also remove duplicate </body> if exists after replacement
$content404 = $content404 -replace '(?s)<footer class="siteFooter.*?</footer>\s*\n\s*</body>', $unifiedFooter + "`n</body>"
$content404 | Out-File $path404 -Encoding ascii -Force
Write-Host "  -> Updated 404.html" -ForegroundColor Green

# === 5b: network-launch.html ===
$pathNl = "C:\ranntaweb-v2\network-launch.html"
$contentNl = Get-Content $pathNl -Raw
$contentNl = $contentNl -replace '(?s)<header[^>]*>.*?</header>', $unifiedHeader
$contentNl = $contentNl -replace '(?s)<footer[^>]*>.*?</footer>', $unifiedFooter
$contentNl | Out-File $pathNl -Encoding ascii -Force
Write-Host "  -> Updated network-launch.html" -ForegroundColor Green

# === 5c: ranta-coin.html ===
$pathRc = "C:\ranntaweb-v2\ranta-coin.html"
$contentRc = Get-Content $pathRc -Raw

# ranta-coin.html has its own inline header AND inline footer
# Replace the inline header <header style="padding: 40px 0; text-align: center;">...</header>
$contentRc = $contentRc -replace '(?s)<header[^>]*>.*?</header>', $unifiedHeader

# Replace the inline footer at the bottom (with style="padding: 60px 20px; text-align: center; border-top: 1px...")
$contentRc = $contentRc -replace '(?s)<footer[^>]*style="padding: 60px 20px; text-align: center; border-top: 1px solid[^>]*>.*?</footer>', $unifiedFooter

# Also remove the duplicate inline .footer div inside the container
$contentRc = $contentRc -replace '(?s)<div class="footer">.*?</div>', ''
$contentRc | Out-File $pathRc -Encoding ascii -Force
Write-Host "  -> Updated ranta-coin.html" -ForegroundColor Green

# === 5d: entity.html - has its own custom footer (site-footer class) and inline header ===
$pathEntity = "C:\ranntaweb-v2\entity.html"
$contentEntity = Get-Content $pathEntity -Raw
$contentEntity = $contentEntity -replace '(?s)<header[^>]*>.*?</header>', $unifiedHeader
$contentEntity = $contentEntity -replace '(?s)<footer class="site-footer".*?</footer>', $unifiedFooter
$contentEntity | Out-File $pathEntity -Encoding ascii -Force
Write-Host "  -> Updated entity.html" -ForegroundColor Green

# === 5e: whitepaper.html - has minimal footer without social icons ===
$pathWp = "C:\ranntaweb-v2\whitepaper.html"
$contentWp = Get-Content $pathWp -Raw
# Replace minimal footer with full footer
$contentWp = $contentWp -replace '(?s)<footer class="siteFooter ranntaFooterBar">.*?</footer>', $unifiedFooter
$contentWp | Out-File $pathWp -Encoding ascii -Force
Write-Host "  -> Updated whitepaper.html (added social icons)" -ForegroundColor Green

# === 5f: roadmap.html - has minimal footer without social icons ===
$pathRm = "C:\ranntaweb-v2\roadmap.html"
$contentRm = Get-Content $pathRm -Raw
$contentRm = $contentRm -replace '(?s)<footer class="siteFooter ranntaFooterBar">.*?</footer>', $unifiedFooter
$contentRm | Out-File $pathRm -Encoding ascii -Force
Write-Host "  -> Updated roadmap.html (added social icons)" -ForegroundColor Green

# --- FIX 6: Clean trailing blank lines in all HTML files ---
Write-Host "[6/6] Cleaning trailing blank lines and trimming whitespace..." -ForegroundColor Yellow

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Remove excessive trailing blank lines (keep max 2 at end)
    $content = $content -replace '\s*\z', "`r`n"
    
    # Remove double blank lines (more than 2 consecutive newlines)
    $content = $content -replace "`r`n`r`n`r`n", "`r`n`r`n"
    $content = $content -replace "`r`n`r`n`r`n", "`r`n`r`n"
    
    $content | Out-File $file.FullName -Encoding ascii -Force
}

Write-Host ""
Write-Host "=== ALL DONE! ===" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  - Fixed broken symbols (??? → • and ?? → ©) in all files" 
Write-Host "  - Removed spurious list items from 15+ files"
Write-Host "  - Updated headers in 404.html, network-launch.html, entity.html, ranta-coin.html"
Write-Host "  - Added social icons to whitepaper.html and roadmap.html footers"
Write-Host "  - Neutralized footer.js"
Write-Host "  - Cleaned trailing whitespace in all files"
