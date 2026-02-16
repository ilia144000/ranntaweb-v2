param(
  [string]$BaseUrl = "https://rannta.com",
  [string]$SiteName = "RANNTA"
)

# ---------- UTF8 No BOM writer (prevents encoding garbage) ----------
function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function New-BackupDir {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $dir = Join-Path (Get-Location).Path ("_bak_seo_harden_" + $ts)
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Get-PageSlug([string]$fileName) {
  if ($fileName -ieq "index.html") { return "" }
  return ($fileName -replace '\.html$','')
}

function Guess-Title([string]$fileName, [string]$html) {
  $m = [regex]::Match($html, '(?is)<title>\s*(.*?)\s*</title>')
  if ($m.Success) {
    $t = $m.Groups[1].Value.Trim()
    if ($t.Length -gt 0) { return $t }
  }

  $p = (($fileName -replace '\.html$','') -replace '-', ' ').Trim()
  if ($fileName -ieq "index.html") { return ("{0} - Official" -f $SiteName) }
  return ("{0} - {1}" -f $SiteName, $p)
}

function Guess-Description([string]$fileName, [string]$html) {
  $m = [regex]::Match($html, '(?is)<meta\s+name=["'']description["'']\s+content=["''](.*?)["'']')
  if ($m.Success) {
    $d = $m.Groups[1].Value.Trim()
    if ($d.Length -ge 30) { return $d }
  }

  $p = (($fileName -replace '\.html$','') -replace '-', ' ').Trim()
  if ($fileName -ieq "index.html") {
    return "RANNTA is a utility-first ecosystem on TON: token, marketplace, registry, and creator tools."
  }
  return ("Learn about {0}: {1}. Official pages, documentation, and ecosystem resources." -f $SiteName, $p)
}

function Ensure-InHead([string]$html, [string]$block, [string]$markerStart, [string]$markerEnd) {
  $pattern = '(?is)\s*<!--\s*' + [regex]::Escape($markerStart) + '\s*-->\s*[\s\S]*?<!--\s*' + [regex]::Escape($markerEnd) + '\s*-->\s*'
  if ([regex]::IsMatch($html, $pattern)) {
    return [regex]::Replace($html, $pattern, "`r`n<!-- $markerStart -->`r`n$block`r`n<!-- $markerEnd -->`r`n")
  }

  if ($html -match '(?is)<head[^>]*>') {
    return [regex]::Replace($html, '(?is)(<head[^>]*>)', "`$1`r`n<!-- $markerStart -->`r`n$block`r`n<!-- $markerEnd -->", 1)
  }

  return $html
}

function Remove-Duplicate-JsonLd([string]$html) {
  # Keep only the first JSON-LD in head, remove others (enterprise-hardening)
  $matches = [regex]::Matches($html, '(?is)<script\s+type=["'']application/ld\+json["'']\s*>[\s\S]*?</script>')
  if ($matches.Count -le 1) { return $html }

  # Remove all JSON-LD scripts; caller will re-inject exactly one (or two for key pages)
  return [regex]::Replace($html, '(?is)<script\s+type=["'']application/ld\+json["'']\s*>[\s\S]*?</script>\s*', '')
}

function Build-JsonLd([string]$BaseUrl, [string]$SiteName, [string]$fileName, [string]$title, [string]$desc) {
  $slug = Get-PageSlug $fileName
  $url = if ($slug -eq "") { "$BaseUrl/" } else { "$BaseUrl/$slug.html" }

  # Put org only on key pages to avoid spam signals
  $key = @("index.html","contracts.html","authoritative.html","team.html","whitepaper.html","what-is-rannta.html")
  $isKey = $key -contains $fileName.ToLowerInvariant()

  if ($isKey) {
    $orgJson = @"
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "$BaseUrl/#organization",
  "name": "$SiteName",
  "url": "$BaseUrl/",
  "logo": "$BaseUrl/assets/brand/coin.png"
}
"@
  } else {
    $orgJson = $null
  }

  $pageJson = @"
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "$title",
  "description": "$desc",
  "url": "$url",
  "isPartOf": { "@id": "$BaseUrl/#organization" }
}
"@

  if ($isKey) {
    return "<script type=""application/ld+json"">`r`n$orgJson`r`n</script>`r`n<script type=""application/ld+json"">`r`n$pageJson`r`n</script>"
  }

  return "<script type=""application/ld+json"">`r`n$pageJson`r`n</script>"
}

function Build-SeoBlock([string]$BaseUrl, [string]$SiteName, [string]$fileName, [string]$title, [string]$desc) {
  $slug = Get-PageSlug $fileName
  $url = if ($slug -eq "") { "$BaseUrl/" } else { "$BaseUrl/$slug.html" }

  $canonical = "<link rel=""canonical"" href=""$url"" />"
  $metaDesc  = "<meta name=""description"" content=""$desc"" />"

  $og = @"
<meta property="og:type" content="website" />
<meta property="og:site_name" content="$SiteName" />
<meta property="og:title" content="$title" />
<meta property="og:description" content="$desc" />
<meta property="og:url" content="$url" />
"@

  $tw = @"
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="$title" />
<meta name="twitter:description" content="$desc" />
"@

  $jsonld = Build-JsonLd $BaseUrl $SiteName $fileName $title $desc

  return @"
<title>$title</title>
$metaDesc
$canonical

$og
$tw

$jsonld
"@
}

# ---------- Main ----------
$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root ".git"))) {
  Write-Host "ERROR: This folder is not a Git repo (.git missing). Run in C:\ranntaweb-v2-repo" -ForegroundColor Red
  exit 1
}

$backupDir = New-BackupDir

# all html in repo (including subfolders), excluding backups and node_modules and .git
$files = Get-ChildItem -Recurse -File -Filter "*.html" |
  Where-Object {
    $_.FullName -notmatch "\\_bak_" -and
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\\\.git\\"
  }

if ($files.Count -lt 1) { throw "No HTML files found." }

foreach ($f in $files) {
  $rel = $f.FullName.Substring($root.Length).TrimStart('\')
  $bakPath = Join-Path $backupDir $rel
  $bakDir = Split-Path -Parent $bakPath
  New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
  Copy-Item $f.FullName $bakPath -Force

  $raw = Get-Content $f.FullName -Raw

  # remove duplicates, then inject one controlled SEO block
  $raw2 = Remove-Duplicate-JsonLd $raw

  $title = Guess-Title $f.Name $raw2
  $desc  = Guess-Description $f.Name $raw2
  $seo   = Build-SeoBlock $BaseUrl $SiteName $f.Name $title $desc

  $raw2 = Ensure-InHead $raw2 $seo "RANNTA: SEO HARDEN (AUTO)" "/RANNTA: SEO HARDEN (AUTO)"

  # normalize excessive blank lines
  $raw2 = [regex]::Replace($raw2, "(\r?\n){4,}", "`r`n`r`n`r`n")

  if ($raw2 -ne $raw) {
    Write-Utf8NoBom $f.FullName $raw2
  }
}

# robots.txt + sitemap.xml (root)
$rootHtml = Get-ChildItem -File -Filter "*.html" | Where-Object { $_.Name -ne "test-banner.html" }
$urls = foreach ($f in $rootHtml) {
  $slug = Get-PageSlug $f.Name
  $loc = if ($slug -eq "") { "$BaseUrl/" } else { "$BaseUrl/$slug.html" }
  "  <url><loc>$loc</loc></url>"
}

$sitemap = @"
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
$($urls -join "`r`n")
</urlset>
"@
Write-Utf8NoBom (Join-Path $root "sitemap.xml") $sitemap

$robots = @"
User-agent: *
Allow: /

Sitemap: $BaseUrl/sitemap.xml
"@
Write-Utf8NoBom (Join-Path $root "robots.txt") $robots

# harden .gitignore (ignore backups + ps1 artifacts)
$giPath = Join-Path $root ".gitignore"
$gi = if (Test-Path $giPath) { Get-Content $giPath -Raw } else { "" }

$want = @(
  "_bak_*",
  "*.bak_*",
  "*.bak",
  "*.tmp"
)

foreach ($line in $want) {
  $escaped = [regex]::Escape($line)
  if ($gi -notmatch "(?m)^\s*$escaped\s*$") {
    $gi = ($gi.TrimEnd() + "`r`n" + $line + "`r`n")
  }
}
Write-Utf8NoBom $giPath $gi

# report
$report = foreach ($f in (Get-ChildItem -Recurse -File -Filter "*.html" | Where-Object { $_.FullName -notmatch "\\_bak_" -and $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\\.git\\" })) {
  $r = Get-Content $f.FullName -Raw
  [pscustomobject]@{
    File = $f.FullName.Substring($root.Length).TrimStart('\')
    JsonLdScripts = ([regex]::Matches($r, 'application/ld\+json', 'IgnoreCase')).Count
    Canonical     = ([regex]::Matches($r, '<link\s+rel=["'']canonical["'']', 'IgnoreCase')).Count
    MetaDesc      = ([regex]::Matches($r, '<meta\s+name=["'']description["'']', 'IgnoreCase')).Count
  }
}

Write-Host ""
Write-Host "SEO hardening completed." -ForegroundColor Green
Write-Host ("Backup saved to: {0}" -f $backupDir) -ForegroundColor DarkGreen
$report | Sort-Object File | Format-Table -AutoSize
