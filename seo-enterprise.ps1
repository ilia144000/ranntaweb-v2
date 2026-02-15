param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [string]$SiteName = "RANNTA",
  [string]$TwitterHandle = "@ranntacoin",
  [string]$LogoUrl = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-BackupDir {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $dir = Join-Path (Get-Location).Path ("_bak_enterprise_seo_{0}" -f $ts)
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Get-PageSlug([string]$fileName) {
  if ($fileName -ieq "index.html") { return "" }
  return ($fileName -replace "\.html$","")
}

function Get-CanonicalUrl([string]$slug) {
  if ([string]::IsNullOrWhiteSpace($slug)) { return "$BaseUrl/" }
  return "$BaseUrl/$slug.html"
}

function HtmlDecode([string]$s) {
  try { return [System.Net.WebUtility]::HtmlDecode($s) } catch { return $s }
}

function Guess-Title([string]$fileName, [string]$raw) {
  $m = [regex]::Match($raw, "(?is)<title>\s*(.*?)\s*</title>")
  if ($m.Success) { return (HtmlDecode($m.Groups[1].Value)).Trim() }

  $h1 = [regex]::Match($raw, "(?is)<h1[^>]*>\s*(.*?)\s*</h1>")
  if ($h1.Success) { return (HtmlDecode($h1.Groups[1].Value)).Trim() }

  $slug = Get-PageSlug $fileName
  if ([string]::IsNullOrWhiteSpace($slug)) { return $SiteName }
  $p = ($slug -replace "-", " ")
  $p = (Get-Culture).TextInfo.ToTitleCase($p)
  return "$p | $SiteName"
}

function Guess-Description([string]$fileName, [string]$raw) {
  $m = [regex]::Match($raw, "(?is)<meta\s+name=['""]description['""]\s+content=['""](.*?)['""]\s*/?>")
  if ($m.Success) { return (HtmlDecode($m.Groups[1].Value)).Trim() }

  $p = Get-PageSlug $fileName
  $p2 = ($p -replace "-", " ")
  if ($fileName -ieq "index.html") {
    return "RANNTA is a utility-first ecosystem on TON: token, marketplace, registry, and creator tools."
  }
  return ("Learn about {0}: {1}. Official pages, documentation, and ecosystem resources." -f $SiteName, $p2)
}

function Ensure-SeoBlock(
  [string]$raw,
  [string]$title,
  [string]$desc,
  [string]$slug,
  [string]$fileName
) {
  $canonical = Get-CanonicalUrl $slug

  $crumbName = if ($fileName -ieq "index.html") { "Home" } else { ($slug -replace "-", " ") }
  $crumbName = (Get-Culture).TextInfo.ToTitleCase($crumbName)

  $ogType = if ($fileName -ieq "index.html") { "website" } else { "article" }

  $logoJson = ""
  if (-not [string]::IsNullOrWhiteSpace($LogoUrl)) {
    $logoJson = @"
    "logo": {
      "@type": "ImageObject",
      "url": "$LogoUrl"
    },
"@
  }

  $jsonOrg = @"
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "$SiteName",
  "url": "$BaseUrl/",
$logoJson  "sameAs": [
    "https://x.com/$($TwitterHandle.TrimStart('@'))"
  ]
}
"@

  $jsonWebPage = @"
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "$title",
  "url": "$canonical",
  "isPartOf": { "@type": "WebSite", "name": "$SiteName", "url": "$BaseUrl/" },
  "about": { "@type": "Thing", "name": "$SiteName" },
  "description": "$desc"
}
"@

  $jsonBreadcrumb = @"
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "$BaseUrl/"
    }
$(if ($fileName -ne "index.html") {
@"
    ,
    {
      "@type": "ListItem",
      "position": 2,
      "name": "$crumbName",
      "item": "$canonical"
    }
"@
} else { "" })
  ]
}
"@

  $block = @"
<!-- === RANNTA: ENTERPRISE SEO v1 (AUTO) === -->
<title>$title</title>
<meta name="description" content="$desc" />
<link rel="canonical" href="$canonical" />
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />

<meta property="og:site_name" content="$SiteName" />
<meta property="og:type" content="$ogType" />
<meta property="og:title" content="$title" />
<meta property="og:description" content="$desc" />
<meta property="og:url" content="$canonical" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="$TwitterHandle" />
<meta name="twitter:title" content="$title" />
<meta name="twitter:description" content="$desc" />

<script type="application/ld+json">
$jsonOrg
</script>
<script type="application/ld+json">
$jsonWebPage
</script>
<script type="application/ld+json">
$jsonBreadcrumb
</script>
<!-- === /RANNTA: ENTERPRISE SEO v1 (AUTO) === -->
"@

  # Remove old enterprise block if exists, then insert fresh
  $clean = [regex]::Replace(
    $raw,
    '(?is)\s*<!--\s*===\s*RANNTA:\s*ENTERPRISE SEO v1 \(AUTO\)\s*===\s*-->\s*[\s\S]*?<!--\s*===\s*/RANNTA:\s*ENTERPRISE SEO v1 \(AUTO\)\s*===\s*-->\s*',
    ''
  )

  $headClose = [regex]::Match($clean, "(?is)</head\s*>")
  if (-not $headClose.Success) { return $raw } # don't touch broken HTML

  $idx = $headClose.Index
  $before = $clean.Substring(0, $idx)
  $after  = $clean.Substring($idx)

  return ($before.TrimEnd() + "`r`n`r`n" + $block + "`r`n" + $after.TrimStart())
}

function Write-RobotsTxt {
  $robots = @"
User-agent: *
Allow: /

Sitemap: $BaseUrl/sitemap.xml
"@
  Set-Content -Path "robots.txt" -Value $robots -Encoding UTF8
}

function Write-SitemapXml([System.IO.FileInfo[]]$files) {
  $items = New-Object System.Collections.Generic.List[string]
  foreach ($f in $files) {
    $slug = Get-PageSlug $f.Name
    $loc  = Get-CanonicalUrl $slug
    $last = ($f.LastWriteTimeUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"))
    $items.Add(@"
  <url>
    <loc>$loc</loc>
    <lastmod>$last</lastmod>
  </url>
"@)
  }

  $xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
$($items -join "")
</urlset>
"@
  Set-Content -Path "sitemap.xml" -Value $xml -Encoding UTF8
}

function Touch-NoJekyll {
  if (-not (Test-Path ".nojekyll")) {
    New-Item -ItemType File -Path ".nojekyll" | Out-Null
  }
}

# ===== Main =====
if (-not ($BaseUrl -match '^https?://')) {
  throw "BaseUrl must start with http:// or https://"
}
$BaseUrl = $BaseUrl.TrimEnd("/")

$root = (Get-Location).Path
$files = Get-ChildItem -File -Filter "*.html"
if ($files.Count -lt 1) { throw "No HTML files found in: $root" }

$backupDir = New-BackupDir
foreach ($f in $files) {
  Copy-Item $f.FullName (Join-Path $backupDir $f.Name) -Force
}

$changed = 0
foreach ($f in $files) {
  $raw = Get-Content $f.FullName -Raw
  $slug  = Get-PageSlug $f.Name
  $title = Guess-Title $f.Name $raw
  $desc  = Guess-Description $f.Name $raw

  $updated = Ensure-SeoBlock $raw $title $desc $slug $f.Name
  $updated = [regex]::Replace($updated, "(\r?\n){4,}", "`r`n`r`n`r`n")

  if ($updated -ne $raw) {
    Set-Content $f.FullName -Value $updated -Encoding UTF8
    $changed++
  }
}

Write-RobotsTxt
Write-SitemapXml $files
Touch-NoJekyll

Write-Host ""
Write-Host ("Backup saved to: {0}" -f $backupDir) -ForegroundColor DarkGreen
Write-Host ("Updated HTML files: {0} / {1}" -f $changed, $files.Count) -ForegroundColor Cyan

# Quick report
$report = foreach ($f in $files) {
  $r = Get-Content $f.FullName -Raw
  [pscustomobject]@{
    File          = $f.Name
    JsonLdScripts = ([regex]::Matches($r, 'application/ld\+json', 'IgnoreCase')).Count
    Canonical     = ([regex]::Matches($r, '<link\s+rel=["'']canonical["'']', 'IgnoreCase')).Count
    MetaDesc      = ([regex]::Matches($r, '<meta\s+name=["'']description["'']', 'IgnoreCase')).Count
  }
}
$report | Sort-Object File | Format-Table -AutoSize
