$footer = Get-Content ".\footer.html" -Raw -Encoding UTF8

Get-ChildItem -Recurse -File -Filter "*.html" |
Where-Object {
  $_.Name -ne "footer.html" -and
  $_.FullName -notmatch "\\_bak" -and
  $_.FullName -notmatch "\\node_modules\\" -and
  $_.FullName -notmatch "\\\.git\\"
} |
ForEach-Object {
  $p = $_.FullName
  $html = Get-Content $p -Raw -Encoding UTF8

  if ($html -match '(?is)<footer\b.*?</footer>') {
    $html = [regex]::Replace($html, '(?is)<footer\b.*?</footer>', $footer)
  }
  elseif ($html -match '(?is)</body>') {
    $html = [regex]::Replace($html, '(?is)</body>', $footer + "`r`n</body>", 1)
  }

  Set-Content $p $html -Encoding UTF8
  Write-Host ("Updated: " + $p)
}

Write-Host "Done."
