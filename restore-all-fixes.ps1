# Emergency Recovery Script - Restore All Content and UI Synchronization

Write-Host "=== EMERGENCY RECOVERY SCRIPT ===" -ForegroundColor Yellow

# ============================================================
# STEP 2: Fix "WHAT IS RANNTA?" box centering in index.html
# ============================================================
Write-Host "[STEP 2] Fixing WHAT IS RANNTA box centering..." -ForegroundColor Cyan

$indexContent = Get-Content "c:\ranntaweb-v2\index.html" -Raw

# Apply the required styles to the rannta-info-card section
$indexContent = $indexContent -replace 'class="rannta-info-card"', 'class="rannta-info-card" style="display: block !important; margin: 60px auto !important; max-width: 850px !important; float: none !important; text-align: center !important;"'

Set-Content "c:\ranntaweb-v2\index.html" $indexContent -NoNewline
Write-Host "  [+] WHAT IS RANNTA box centered." -ForegroundColor Green

# ============================================================
# STEP 3: Remove ALL "Back to Home" links
# ============================================================
Write-Host "[STEP 3] Removing ALL Back to Home links..." -ForegroundColor Cyan

$filesWithBackHome = @(
    "airdrop.html", "articles.html", "authoritative.html", "burn.html",
    "contact.html", "contracts.html", "gallery.html", "kyc.html",
    "manifesto.html", "nft.html", "rannta-story.html", "ranntaverse.html",
    "roadmap.html", "signal-13.html", "swap.html", "symbolists.html",
    "team.html", "what-is-rannta.html", "whitepaper.html"
)

# Pattern 1: Multi-line backHomeBtn (most common)
$pattern1 = '<a class="backHomeBtn"[^>]*>\s*<span class="arrow"></span>\s*<span class="label">Back to Home</span>\s*</a>'
$pattern1b = '<a class="backHomeBtn"[^>]*>\s*<span class="label">Back to Home</span>\s*</a>'

foreach ($file in $filesWithBackHome) {
    $path = "c:\ranntaweb-v2\$file"
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        $original = $content
        
        # Remove with arrow
        $content = $content -replace $pattern1, ""
        # Remove without arrow
        $content = $content -replace $pattern1b, ""
        
        if ($content -ne $original) {
            Set-Content $path $content -NoNewline
            Write-Host "  [+] Back to Home removed from $file" -ForegroundColor Green
        }
    }
}

# Also handle entity.html which has "Back to RANNTA Home"
$entityPath = "c:\ranntaweb-v2\entity.html"
if (Test-Path $entityPath) {
    $content = Get-Content $entityPath -Raw
    # Remove the back-wrap div containing "Back to RANNTA Home"
    $content = $content -replace '<div class="back-wrap">\s*<a class="back"[^>]*>[^<]*</a>\s*</div>', ""
    Set-Content $entityPath $content -NoNewline
    Write-Host "  [+] Back to RANNTA Home removed from entity.html" -ForegroundColor Green
}

Write-Host "  [STEP 3] All Back to Home links removed." -ForegroundColor Green

# ============================================================
# STEP 4: Fix Footer Symbols
# ============================================================
Write-Host "[STEP 4] Fixing footer symbols..." -ForegroundColor Cyan

$footerFiles = @(
    "404.html", "airdrop.html", "articles.html", "authoritative.html",
    "burn.html", "contact.html", "contracts.html", "gallery.html",
    "index.html", "kyc.html", "manifesto.html", "nft.html",
    "rannta-story.html", "ranntaverse.html", "roadmap.html",
    "signal-13.html", "swap.html", "symbolists.html", "team.html",
    "what-is-rannta.html", "whitepaper.html"
)

foreach ($file in $footerFiles) {
    $path = "c:\ranntaweb-v2\$file"
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        $original = $content
        
        # Replace "(c) 2025 RANNTA - Powered by TON | Griffin Protocol Active"
        $content = $content -replace '\(c\) 2025 RANNTA - Powered by TON \| Griffin Protocol Active', '&copy; 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.'
        
        # Replace "(c) 2025 RANNTA - Powered by TON"
        $content = $content -replace '\(c\) 2025 RANNTA - Powered by TON', '&copy; 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.'
        
        if ($content -ne $original) {
            Set-Content $path $content -NoNewline
            Write-Host "  [+] Footer fixed in $file" -ForegroundColor Green
        }
    }
}

# Fix entity.html footer (uses site-footer__copy class)
$entityPath = "c:\ranntaweb-v2\entity.html"
if (Test-Path $entityPath) {
    $content = Get-Content $entityPath -Raw
    $content = $content -replace '\(c\) 2025 RANNTA - Powered by TON', '&copy; 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.'
    Set-Content $entityPath $content -NoNewline
    Write-Host "  [+] Footer fixed in entity.html" -ForegroundColor Green
}

# Fix rannta.html footer (uses footer__copy class)
$ranntaPath = "c:\ranntaweb-v2\rannta.html"
if (Test-Path $ranntaPath) {
    $content = Get-Content $ranntaPath -Raw
    $content = $content -replace '\(c\) 2025 RANNTA - Powered by TON', '&copy; 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.'
    Set-Content $ranntaPath $content -NoNewline
    Write-Host "  [+] Footer fixed in rannta.html" -ForegroundColor Green
}

# Fix ranta-coin.html which has © 2026 RANNTA Protocol — Built on TON
$rantaCoinPath = "c:\ranntaweb-v2\ranta-coin.html"
if (Test-Path $rantaCoinPath) {
    $content = Get-Content $rantaCoinPath -Raw
    $content = $content -replace '© 2026 RANNTA Protocol — Built on TON', '&copy; 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.'
    Set-Content $rantaCoinPath $content -NoNewline
    Write-Host "  [+] Footer fixed in ranta-coin.html" -ForegroundColor Green
}

# Fix footer.html (the standalone footer template)
$footerPath = "c:\ranntaweb-v2\footer.html"
if (Test-Path $footerPath) {
    $content = Get-Content $footerPath -Raw
    $content = $content -replace '\(c\) 2025 RANNTA - Powered by TON', '&copy; 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.'
    Set-Content $footerPath $content -NoNewline
    Write-Host "  [+] Footer fixed in footer.html" -ForegroundColor Green
}

Write-Host "[STEP 4] All footer symbols fixed." -ForegroundColor Green

# ============================================================
# Fix network-launch.html (was 4 bytes/empty)
# ============================================================
$networkLaunchPath = "c:\ranntaweb-v2\network-launch.html"
if ((Get-Item $networkLaunchPath).Length -lt 100) {
    $minimalContent = @'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Network Launch - RANNTA</title>
<link rel="stylesheet" href="/style.css">
<meta name="robots" content="noindex, nofollow">
</head>
<body>
<header>
<img src="assets/brand/coin.png?v=2" alt="RANNTA Logo" class="logo" />
<nav>
<ul>
<li><a href="index.html">Home</a></li>
</ul>
</nav>
</header>
<main>
<h1>Network Launch</h1>
<p>Network launch information coming soon.</p>
</main>
<footer class="siteFooter ranntaFooterBar" role="contentinfo" aria-label="Site footer">
<div class="siteFooter__inner">
<div class="siteFooter__copy">&copy; 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.</div>
</div>
</footer>
</body>
</html>
'@
    Set-Content $networkLaunchPath $minimalContent -NoNewline
    Write-Host "  [+] network-launch.html restored from template." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== ALL FIXES APPLIED SUCCESSFULLY ===" -ForegroundColor Yellow
