# RANNTA Sentinel

Use Node 20+ to preview the existing website and the scan endpoint on the same
origin. There are no additional runtime packages.

```text
node sentinel-server/local.mjs
node --test sentinel-server/sentinel.test.mjs
python sentinel-server/browser_test.py
```

The local URL is http://127.0.0.1:8794/sentinel. The POST endpoint accepts
`{"network":"ethereum","address":"0x..."}`. Network keys are ethereum, bsc,
base, polygon and solana. Use a public contract address or Solana mint.
The optional browser regression uses Playwright with an installed Chromium or
the executable selected by SENTINEL_BROWSER. It runs against the local server.

## Evidence

EVM reads are pinned to a block on the selected chain. Source matching and ABI
signals come from Sourcify. GoPlus supplies reported trading, holder and LP
signals. Solana reads finalized, parsed mint data. Holder percentages require
matching finalized slots. GoPlus supplies Solana metadata and indexed holder
evidence when direct RPC coverage is limited. If reported supply differs by
more than 5% from on-chain supply, indexed percentages do not count toward the
score. Selected indexed accounts can be rechecked at one finalized slot and
then shown as lower bounds. DEX Screener supplies liquidity for reported pairs
only. These sources observe different aspects of an asset and can be incomplete.

The rule module specifies each penalty and its evidence. A numeric score
requires confirmed chain identity and results from scored checks in three of
the four evidence sections, including control. Unknown checks never count as coverage. The report
shows partial results and names failed sources.

## Production

The existing site is served by GitHub Pages. Publish the static site changes
only when the same-origin POST route is available. GitHub Pages does not run
the scanner. The worker configuration binds the scan route to rannta.com
and resolves the three canonical page paths to their static directory indexes.
This requires an authenticated Cloudflare
deployment and a proxied rannta.com DNS record. Verify the existing site and
TLS before publishing, and verify the POST route on the actual hostname.
An already authorized same-origin reverse proxy can mount the same handler.

Public upstreams require no credentials for the supported baseline checks.
If a GoPlus token is supplied, configure SENTINEL_GOPLUS_TOKEN as a server
secret. Do not put it in a static file or Worker configuration. The worker
does not persist submitted addresses or run collection jobs. Per-isolate rate
limits and concurrent work bounds protect the public sources. Apply a global
rate limit at the edge if deployment traffic requires one.
