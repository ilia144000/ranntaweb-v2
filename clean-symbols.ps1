$t = Get-Content .\index.html -Raw

# remove common mojibake lead bytes using Unicode codes:
# U+00C2 (Â), U+00C3 (Ã), U+00F0 (ð)
$t = $t -replace ([char]0x00C2), ''
$t = $t -replace ([char]0x00C3), ''
$t = $t -replace ([char]0x00F0), ''

[IO.File]::WriteAllText((Resolve-Path .\index.html), $t, [Text.Encoding]::UTF8)
"OK"
