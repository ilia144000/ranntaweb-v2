# PowerShell script to unify headers, fix typos, and harden CSS

# 1. DEFINE THE UNIFIED COMPONENTS
$navHtml = @"
    <header style="padding: 40px 0; text-align: center;">
        <nav>
            <ul style="display: flex; justify-content: center; flex-wrap: wrap; gap: 15px; list-style: none; padding: 0; max-width: 1000px; margin: 0 auto;">
                <li><a href="network-launch.html" style="color: #EAB308; font-weight: bold; text-decoration: none;">RANNTA Network</a></li>
                <li><a href="index.html" style="color: white; text-decoration: none;">Home</a></li>
                <li><a href="articles.html" style="color: white; text-decoration: none;">Articles</a></li>
                <li><a href="whitepaper.html" style="color: white; text-decoration: none;">Whitepaper</a></li>
                <li><a href="contracts.html" style="color: white; text-decoration: none;">Contracts</a></li>
                <li><a href="rannta.html" style="color: white; text-decoration: none;">AI-Index</a></li>
            </ul>
        </nav>
    </header>
"@

$footerHtml = @"
    <footer style="padding: 60px 20px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 80px;">
        <p style="color: #94A3B8; font-size: 14px;">
            &copy; 2025 RANNTA Network. All rights reserved. Powering the Internet of Blockchains.
        </p>
    </footer>
"@

# 2. APPLY TO ALL HTML FILES
$files = Get-ChildItem -Path "C:\ranntaweb-v2" -Filter "*.html" -Recurse

foreach ($file in $files) {
    Write-Host "Processing: $($file.FullName)"
    $content = Get-Content $file.FullName -Raw
    
    # Force fix the "Ranta" typo everywhere
    $content = $content -replace "Ranta Coin Clarification", "RANNTA Coin Clarification"
    $content = $content -replace "(?<![A-Z])Ranta(?![A-Za-z])", "RANNTA"

    # Check if page has a <header> tag at all
    if ($content -notmatch '<header') {
        # Page is missing a header entirely - inject one after <body>
        $content = $content -replace '(<body[^>]*>)', "`$1`r`n$navHtml"
        Write-Host "  -> Added header to $($file.Name)"
    }

    # Check if page is missing the network-launch.html link
    if ($content -notmatch 'network-launch\.html') {
        Write-Host "  -> WARNING: $($file.Name) is missing RANNTA Network link"
    }

    # Check if page has a <footer> tag at all
    if ($content -notmatch '<footer') {
        # Page is missing a footer entirely - inject one before </body>
        $content = $content -replace '(</body>)', "$footerHtml`r`n`$1"
        Write-Host "  -> Added footer to $($file.Name)"
    }
    
    $content | Out-File $file.FullName -Encoding ascii -Force
}

Write-Host "`n=== File processing complete ==="

# 3. THE ULTIMATE CSS FIX (ANTI-TRAIN & PRO-CENTER)
$finalCSS = @"

/* RANNTA CORE ARCHITECTURE - VERSION 2.0 */
body { 
    background-color: #0B0F19 !important; 
    color: white !important; 
    margin: 0 auto !important; 
    max-width: 1200px !important; 
    text-align: center !important;
    display: block !important; /* Reset flex to prevent vertical stretching */
}

nav ul { 
    display: flex !important; 
    justify-content: center !important; 
    flex-wrap: wrap !important; /* THIS BREAKS THE TRAIN LOOK */
    gap: 15px 25px !important;
    padding: 20px !important;
}

nav ul li a {
    white-space: nowrap !important;
    font-size: 14px !important;
    text-transform: uppercase !important;
    letter-spacing: 1px !important;
}

section, main, article, footer {
    width: 100% !important;
    max-width: 1000px !important;
    margin: 0 auto !important;
    padding: 40px 20px !important;
}

footer p {
    color: #94A3B8 !important;
    font-size: 0.9rem !important;
}
"@

# Append the ultimate CSS to style.css
Add-Content -Path "C:\ranntaweb-v2\style.css" -Value $finalCSS

Write-Host "`n=== CSS appended to style.css ==="
Write-Host "`n=== ALL DONE ==="
