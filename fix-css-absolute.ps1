param(
  [string]$Root = "."
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Backup-File([string]$Path) {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$Path.bak_cssabs_$ts"
  Copy-Item -LiteralPath $Path -Destination $bak -Force
  return $bak
}

$files = Get-ChildItem -Path $Root -Recurse -File -Filter "*.html" |
  Where-Object { $_.FullName -notmatch "\\_bak_" -and $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\\.git\\" }

$changed = 0

foreach ($f in $files) {
  $raw = Get-Content -LiteralPath $f.FullName -Raw

  # Replace only the exact stylesheet href, leave everything else intact
  if ($raw -match 'rel="stylesheet"\s+href="style\.css"\s*/?>') {
    $raw2 = $raw -replace 'rel="stylesheet"\s+href="style\.css"', 'rel="stylesheet" href="/style.css"'
    if ($raw2 -ne $raw) {
      Backup-File $f.FullName | Out-Null
      Write-Utf8NoBom $f.FullName $raw2
      $changed++
      Write-Host "Fixed: $($f.FullName)"
    }
  }
}

Write-Host ""
Write-Host "Done. Files changed: $changed"
