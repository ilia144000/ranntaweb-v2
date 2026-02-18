param(
  [string]$IndexPath = "index.html",
  [string]$CssPath   = "style.css"
)

$ErrorActionPreference = "Stop"

function Get-FullPath([string]$p, [string]$baseDir) {
  if ([System.IO.Path]::IsPathRooted($p)) { return $p }
  return [System.IO.Path]::GetFullPath((Join-Path $baseDir $p))
}

function Ensure-Writable([string]$path) {
  if (!(Test-Path -LiteralPath $path)) { throw "File not found: $path" }
  $item = Get-Item -LiteralPath $path
  if ($item.Attributes -band [System.IO.FileAttributes]::ReadOnly) {
    $item.Attributes = ($item.Attributes -bxor [System.IO.FileAttributes]::ReadOnly)
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Backup-File([string]$Path) {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  $bak = "$Path.bak_$ts"
  Copy-Item -LiteralPath $Path -Destination $bak -Force
  return $bak
}

# Always resolve relative paths from script folder
$baseDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

$IndexFull = Get-FullPath $IndexPath $baseDir
$CssFull   = Get-FullPath $CssPath $baseDir

Ensure-Writable $IndexFull
Ensure-Writable $CssFull

$markerStart = "<!-- === RANNTA: HERO CONVERSION STRIP (HYBRID) === -->"
$markerEnd   = "<!-- === /RANNTA: HERO CONVERSION STRIP (HYBRID) === -->"
$cssMarker   = "/* === RANNTA: HERO CONVERSION STRIP (HYBRID) === */"

$indexBak = Backup-File $IndexFull
$cssBak   = Backup-File $CssFull

$index = Get-Content -LiteralPath $IndexFull -Raw
$css   = Get-Content -LiteralPath $CssFull -Raw

# -------- index.html insert (before the hero H1) --------
if ($index -match [regex]::Escape($markerStart)) {
  Write-Host "Index already contains conversion strip markers. Skipping index insert."
} else {
  $needle = "<h1>RANNTA is not a token. It is a Signal.</h1>"
  $pos = $index.IndexOf($needle)
  if ($pos -lt 0) { throw "Insert point not found in index.html (hero H1 not found)." }

  $block = @'
<!-- === RANNTA: HERO CONVERSION STRIP (HYBRID) === -->
<div class="conversion-strip" role="region" aria-label="RANNTA quick actions">
  <div class="conversion-strip__top">
    <div class="conversion-strip__brand">
      <div class="conversion-strip__title">RANNTA on TON</div>
      <div class="conversion-strip__meta">Official Jetton Master</div>
    </div>

    <div class="conversion-strip__actions">
      <a class="btnConv primary" href="https://app.ston.fi/swap?ft=TON&tt=EQBCY5Yj9G6VAQibTe6hz53j8vBNO234n0fzHUP3lUBBYbeR&chartInterval=1w" target="_blank" rel="noopener noreferrer">
        Buy on STON.fi
      </a>
      <a class="btnConv ghost" href="contracts.html">
        Verify
      </a>
    </div>
  </div>

  <div class="contract-box" data-ca-full="EQBCY5Yj9G6VAQibTe6hz53j8vBNO234n0fzHUP3lUBBYbeR">
    <div class="contract-box__label">Contract</div>
    <div class="contract-box__value" aria-label="RANNTA contract address">
      <span class="ca-short">EQBCY5Yj9G6...BYbeR</span>
      <span class="ca-full sr-only">EQBCY5Yj9G6VAQibTe6hz53j8vBNO234n0fzHUP3lUBBYbeR</span>
    </div>

    <button type="button" class="btnCopy" data-copy-ca aria-label="Copy contract address">
      Copy
    </button>
  </div>

  <div class="conversion-strip__links" aria-label="Explorer links">
    <a href="https://tonviewer.com/EQBCY5Yj9G6VAQibTe6hz53j8vBNO234n0fzHUP3lUBBYbeR" target="_blank" rel="noopener noreferrer">TON Viewer</a>
    <a href="https://tonscan.org/jetton/EQBCY5Yj9G6VAQibTe6hz53j8vBNO234n0fzHUP3lUBBYbeR" target="_blank" rel="noopener noreferrer">TON Scan</a>
    <a href="https://dyor.io/token/EQBCY5Yj9G6VAQibTe6hz53j8vBNO234n0fzHUP3lUBBYbeR" target="_blank" rel="noopener noreferrer">DYOR</a>
    <a href="https://www.geckoterminal.com/ton/pools/EQABEUPHJixGRBEHRbl3RfXYLA2lKuZsXGad_F65edDWB8cM?utm_source=coingecko&utm_medium=referral&utm_campaign=searchresults" target="_blank" rel="noopener noreferrer">GeckoTerminal</a>
  </div>
</div>

<script>
  (function () {
    try {
      var btn = document.querySelector('[data-copy-ca]');
      if (!btn) return;

      btn.addEventListener('click', async function () {
        var box = btn.closest('.contract-box');
        var full = (box && box.getAttribute('data-ca-full')) ? box.getAttribute('data-ca-full') : '';
        if (!full) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(full);
        } else {
          var ta = document.createElement('textarea');
          ta.value = full;
          ta.setAttribute('readonly', 'readonly');
          ta.style.position = 'absolute';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }

        var prev = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = prev || 'Copy';
          btn.classList.remove('copied');
        }, 1200);
      });
    } catch (e) {}
  })();
</script>
<!-- === /RANNTA: HERO CONVERSION STRIP (HYBRID) === -->

'@

  $index2 = $index.Substring(0, $pos) + $block + $index.Substring($pos)
  Write-Utf8NoBom $IndexFull $index2
  Write-Host "Inserted conversion strip into index.html"
}

# -------- style.css append --------
if ($css -match [regex]::Escape($cssMarker)) {
  Write-Host "CSS already contains conversion strip marker. Skipping CSS append."
} else {
  $cssAdd = @'
/* === RANNTA: HERO CONVERSION STRIP (HYBRID) === */

.conversion-strip {
  margin: 14px 0 18px;
  padding: 14px 14px 12px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(10,10,10,0.78), rgba(18,18,18,0.92));
  border: 1px solid rgba(212, 175, 55, 0.45);
  box-shadow:
    0 0 0 1px rgba(212, 175, 55, 0.10) inset,
    0 10px 28px rgba(0,0,0,0.35);
}

.conversion-strip__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.conversion-strip__title {
  font-family: 'Cinzel Decorative', serif;
  font-size: 15px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(212,175,55,0.95);
  margin-bottom: 2px;
}

.conversion-strip__meta {
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  color: rgba(245,245,245,0.70);
}

.conversion-strip__actions {
  display: inline-flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btnConv {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 700;
  letter-spacing: 0.01em;
  font-size: 13px;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 8px 18px rgba(0,0,0,0.28);
  transition: transform 0.18s ease, filter 0.18s ease, background 0.18s ease;
}

.btnConv.primary {
  background: linear-gradient(180deg, rgba(212,175,55,0.95), rgba(160,120,20,0.95));
  color: #0b0b0b;
}

.btnConv.ghost {
  background: rgba(0,0,0,0.18);
  border: 1px solid rgba(212,175,55,0.40);
  color: rgba(245,245,245,0.92);
}

.btnConv:hover { transform: translateY(-1px); filter: brightness(1.03); }
.btnConv:active { transform: translateY(0); }

.contract-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px;
  border-radius: 12px;
  background: rgba(8,8,8,0.55);
  border: 1px solid rgba(255,215,0,0.22);
}

.contract-box__label {
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  color: rgba(245,245,245,0.70);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex: 0 0 auto;
}

.contract-box__value {
  flex: 1 1 auto;
  min-width: 0;
}

.ca-short {
  font-family: "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 13px;
  color: rgba(245,245,245,0.95);
  word-break: break-word;
}

.btnCopy {
  flex: 0 0 auto;
  cursor: pointer;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 700;
  padding: 9px 10px;
  border-radius: 10px;
  background: rgba(255,215,0,0.12);
  border: 1px solid rgba(255,215,0,0.35);
  color: rgba(255,215,0,0.95);
  transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
}

.btnCopy:hover {
  background: rgba(255,215,0,0.20);
  transform: translateY(-1px);
}

.btnCopy.copied {
  background: rgba(212,175,55,0.85);
  color: #0b0b0b;
  border-color: rgba(255,255,255,0.14);
}

.conversion-strip__links {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 12px;
}

.conversion-strip__links a {
  color: rgba(160,220,255,0.95);
  text-decoration: none;
  border-bottom: 1px dotted rgba(160,220,255,0.35);
}

.conversion-strip__links a:hover {
  color: rgba(212,175,55,0.95);
  border-bottom-color: rgba(212,175,55,0.40);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .conversion-strip__top {
    flex-direction: column;
    align-items: flex-start;
  }
  .conversion-strip__actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 480px) {
  .contract-box {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .btnCopy {
    width: 100%;
  }
}

/* === /RANNTA: HERO CONVERSION STRIP (HYBRID) === */

'@

  $css2 = $css.TrimEnd() + "`r`n`r`n" + $cssAdd
  Write-Utf8NoBom $CssFull $css2
  Write-Host "Appended conversion strip CSS to style.css"
}

Write-Host ""
Write-Host "Done."
Write-Host "Backups created:"
Write-Host "  $indexBak"
Write-Host "  $cssBak"
