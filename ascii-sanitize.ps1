$p = "index.html"
$bak = "$p.bak_ascii_" + (Get-Date -Format "yyyyMMdd_HHmmss")
Copy-Item $p $bak -Force

$t = Get-Content $p -Raw

# Keep only ASCII + whitespace (CR/LF/TAB)
$chars = $t.ToCharArray() | Where-Object { $_ -eq "`r" -or $_ -eq "`n" -or $_ -eq "`t" -or [int]$_ -le 127 }
$t = -join $chars

# Fix common apostrophes after sanitize
$t = $t.Replace("RANNTA isnt just a token - its a symbol of speed, truth, and sovereignty in a decentralized future.",
                "RANNTA isn't just a token - it's a symbol of speed, truth, and sovereignty in a decentralized future.")

[IO.File]::WriteAllText((Resolve-Path $p), $t, (New-Object Text.UTF8Encoding($false)))
"OK"
