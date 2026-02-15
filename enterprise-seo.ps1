# ==============================
# RANNTA Enterprise SEO Script
# Safe ASCII Version
# ==============================

$BaseUrl  = "https://rannta.com"
$SiteName = "RANNTA"

function New-BackupDir {
    $ts = Get-Date -Format "yyyyMMdd_HHmmss"
    $dir = Join-Path (Get-Location) "_bak_enterprise_seo_$ts"
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    return $dir
}

function Get-PageSlug($fileName) {
    if ($fileName -ieq "index.html") { return "" }
    return ($fileName -replace "\.html$","")
}

function Build-SeoBlock($title, $desc, $slug) {

    if ($slug -eq "") {
        $url = $BaseUrl
    } else {
        $url = "$BaseUrl/$slug.html"
    }

@"
<!-- ENTERPRISE SEO BLOCK -->
<title>$title</title>
<meta name="description" content="$desc" />
<link rel="canonical" href="$url" />

<meta property="og:title" content="$title" />
<meta property="og:description" content="$desc" />
<meta property="og:url" content="$url" />
<meta property="og:type" content="website" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="$title" />
<meta name="twitter:description" content="$desc" />

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "$title",
  "description": "$desc",
  "url": "$url"
}
</script>
<!-- /ENTERPRISE SEO BLOCK -->
"@
}

# ==============================
# MAIN
# ==============================

$root = (Get-Location).Path
$files = Get-ChildItem -File -Filter "*.html"

if ($files.Count -lt 1) {
    throw "No HTML files found."
}

$backupDir = New-BackupDir

foreach ($f in $files) {

    Copy-Item $f.FullName (Join-Path $backupDir $f.Name) -Force

    $raw = Get-Content $f.FullName -Raw

    $slug = Get-PageSlug $f.Name

    if ($f.Name -ieq "index.html") {
        $title = "$SiteName Official Website"
        $desc  = "RANNTA is a utility-first ecosystem on TON: token, marketplace, registry and creator tools."
    } else {
        $p = ($f.Name -replace "\.html$","") -replace "-", " "
        $title = "$SiteName - $p"
        $desc  = "Official page of $SiteName about $p."
    }

    $seoBlock = Build-SeoBlock $title $desc $slug

    # Remove old ENTERPRISE SEO block if exists
    $raw = [regex]::Replace(
        $raw,
        '(?is)<!-- ENTERPRISE SEO BLOCK -->.*?<!-- /ENTERPRISE SEO BLOCK -->',
        ''
    )

    # Inject after <head>
    if ($raw -match '(?is)<head[^>]*>') {
        $updated = [regex]::Replace(
            $raw,
            '(?is)(<head[^>]*>)',
            "`$1`r`n$seoBlock",
            1
        )
    } else {
        $updated = $raw
    }

    Set-Content -Path $f.FullName -Value $updated -Encoding UTF8
}

Write-Host ""
Write-Host "Enterprise SEO upgrade completed."
Write-Host "Backup saved to: $backupDir"
Write-Host ""
