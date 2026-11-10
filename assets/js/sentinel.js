"use strict";

const form = document.getElementById("sentinel-form");
const network = form.elements.network;
const address = form.elements.address;
const button = form.querySelector("button");
const statusLine = document.getElementById("sentinel-progress");
const output = document.getElementById("sentinel-report");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const btc = sats => (Number(sats || 0) / 100000000).toFixed(8) + " BTC";

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function updateFormat() {
  const selected = network.value;
  const bitcoin = selected === "bitcoin";
  const solana = selected === "solana";
  form.querySelector('label[for="sentinel-address"]').textContent = bitcoin ? "Bitcoin address" :
    solana ? "Token mint address" : "Token contract address";
  address.placeholder = bitcoin ? "bc1… / 1… / 3…" : solana ? "Solana token mint address" : "0x…";
  address.maxLength = bitcoin ? 90 : 44;
  document.getElementById("sentinel-format").textContent = bitcoin ? "Enter a Bitcoin mainnet address." :
    solana ? "Enter the public base58 token mint address." :
    "Enter the public token contract address for the selected network.";
  button.firstChild.nodeValue = bitcoin ? "Scan Bitcoin address " : "Scan token ";
  address.removeAttribute("aria-invalid");
}

function showStatus(text, error = false) {
  statusLine.textContent = text;
  statusLine.toggleAttribute("data-error", error);
}

function render(data) {
  const { asset, risk, findings } = data;
  const bitcoin = data.reportType === "bitcoin";
  const headline = element("div", null, "sentinel-headline");
  const identity = element("div", null, "sentinel-asset");
  const title = element("h2", bitcoin ? "Bitcoin address" :
    asset.name ? asset.name + (asset.symbol ? " (" + asset.symbol + ")" : "") : asset.symbol || "Scan report");
  const time = element("time", data.scannedAt.replace("T", " ").replace(/\.\d{3}Z$/, " UTC"));
  time.dateTime = data.scannedAt;
  const timestamp = element("p", "Scanned ");
  timestamp.append(time);
  identity.append(element("p", "OVERVIEW", "sentinel-eyebrow"), title,
    element("p", data.networkLabel + " · " + data.assetStatus),
    element("p", data.address));
  if (bitcoin && data.bitcoin) {
    identity.append(
      element("p", "Balance: " + btc(data.bitcoin.currentBalanceSats)),
      element("p", "Confirmed transactions: " + data.bitcoin.confirmedTxCount),
      element("p", "UTXOs: " + data.bitcoin.utxoCount)
    );
  } else {
    identity.append(element("p", "Supply: " + (asset.supply ?? "Unknown")));
  }
  identity.append(timestamp);
  if (asset.metadataSource) identity.append(element("p", "Source: " + asset.metadataSource));
  if (asset.chainPosition) identity.append(element("p", (data.network === "solana" ? "Finalized slot " : "Block ") + asset.chainPosition));
  if (data.assetStatus !== "CONFIRMED") identity.append(element("p", data.assetDetail));

  const score = element("div", null, "sentinel-score");
  score.dataset.level = risk.level;
  const print = element("button", "Print report", "sentinel-print");
  print.type = "button";
  print.addEventListener("click", () => window.print());

  if (bitcoin && data.bitcoin) {
    score.append(
      element("h3", "CURRENT BALANCE"),
      element("strong", btc(data.bitcoin.currentBalanceSats)),
      element("p", data.bitcoin.confirmedTxCount + " confirmed tx · " + data.bitcoin.utxoCount + " UTXO"),
      element("p", data.bitcoin.unconfirmedTxCount + " unconfirmed tx")
    );
  } else {
    score.append(
      element("h3", "RISK SCORE"),
      element("strong", risk.value === null ? "—" : risk.value + " / 100"),
      element("p", risk.level),
      element("p", risk.warnings + " warnings · " + risk.critical + " high-risk · " + risk.unknown + " unknown"),
      element("p", risk.coveredGroups + " of " + risk.totalGroups + " evidence sections · " + data.ruleVersion)
    );
    if (risk.value === null && risk.evidencedPoints > 0) {
      score.append(element("p", "Observed penalties: " + risk.evidencedPoints + " points"));
    }
  }
  score.append(print);
  headline.append(identity, score);

  const defaultSections = [["control", "Contract control"], ["trading", "Trading safety"],
    ["liquidity", "Liquidity"], ["holders", "Holder distribution"]];
  const grid = element("div", null, "sentinel-grid");
  for (const [group, label] of (data.sections || defaultSections)) {
    const card = element("section", null, "sentinel-card");
    card.append(element("h3", label));
    const rows = element("ul", null, "sentinel-findings");
    for (const finding of findings.filter(item => item.section === group)) {
      const row = element("li", finding.label);
      const status = element("span", finding.status, "sentinel-tag");
      status.dataset.status = finding.status;
      row.append(status);
      rows.append(row);
    }
    card.append(rows);
    const figures = element("ul", null, "sentinel-lines");
    if (!bitcoin && group === "liquidity") {
      const liquidity = data.liquidity;
      if (liquidity) {
        figures.append(element("li", usd.format(liquidity.usd) + " across " + liquidity.poolCount + " tracked pools"));
        for (const pool of liquidity.pools) {
          figures.append(element("li", pool.venue + " · " + usd.format(pool.liquidity) + " · " + pool.pair));
        }
      }
      for (const holder of data.lpHolders) {
        figures.append(element("li", "LP · " + number.format(holder.percentage) + "% · " + holder.address +
          (holder.locked === null ? "" : holder.locked ? " · reported locked" : " · reported unlocked")));
      }
    } else if (!bitcoin && group === "holders" && data.holders.length) {
      figures.append(element("li", data.holderType));
      for (const holder of data.holders) {
        figures.append(element("li", number.format(holder.percentage) + "% · " + holder.address));
      }
    } else if (bitcoin && group === "funds" && data.bitcoin) {
      figures.append(
        element("li", "Confirmed balance · " + btc(data.bitcoin.confirmedBalanceSats)),
        element("li", "Pending delta · " + btc(data.bitcoin.pendingDeltaSats)),
        element("li", "Funded outputs · " + data.bitcoin.fundedOutputCount),
        element("li", "Spent outputs · " + data.bitcoin.spentOutputCount)
      );
    }
    if (figures.childElementCount) card.append(figures);
    grid.append(card);
  }

  const evidence = element("section", null, "sentinel-evidence");
  evidence.append(element("h3", "Evidence"));
  for (const item of findings) {
    const summary = item.label + " · " + item.status + (item.points ? " · +" + item.points + " points" : "");
    const source = item.source + " · " + item.detail;
    const disclosure = element("details");
    disclosure.append(element("summary", summary), element("p", source), element("p", item.explanation));
    const printable = element("div", null, "sentinel-print-detail");
    printable.append(element("h4", summary), element("p", source), element("p", item.explanation));
    evidence.append(disclosure, printable);
  }
  evidence.append(element("h4", "Source coverage"));
  for (const item of data.sources) {
    evidence.append(element("p", item.name + " · " + item.status + (item.detail ? " · " + item.detail : "")));
  }
  if (!bitcoin) {
    evidence.append(element("h4", "Scoring"),
      element("p", "A score requires confirmed identity and sufficient evidence. Unknown checks add no points."));
  }
  for (const limit of data.limitations || []) evidence.append(element("p", limit));

  output.replaceChildren(headline, grid, evidence);
  output.hidden = false;
}

const preselected = new URL(location.href).searchParams.get("network");
if ([...network.options].some(option => option.value === preselected)) network.value = preselected;
updateFormat();
network.addEventListener("change", updateFormat);
address.addEventListener("input", () => address.removeAttribute("aria-invalid"));

form.addEventListener("submit", async event => {
  event.preventDefault();
  const value = address.value.trim();
  const selected = network.value;
  const bitcoin = selected === "bitcoin";
  const solana = selected === "solana";
  const bitcoinShape = /^(?:(?:1|3)[1-9A-HJ-NP-Za-km-z]{25,34}|(?:bc1|BC1)[0-9A-Za-z]{8,87})$/;
  const valid = bitcoin ? bitcoinShape.test(value) :
    solana ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value) :
    /^0x[0-9a-fA-F]{40}$/.test(value);
  if (!valid) {
    address.setAttribute("aria-invalid", "true");
    showStatus(bitcoin ? "Enter a valid Bitcoin mainnet address." :
      solana ? "Enter a valid Solana token mint address." :
      "Enter a valid 42-character EVM token contract address.", true);
    address.focus();
    return;
  }
  button.disabled = network.disabled = address.disabled = true;
  output.hidden = true;
  form.setAttribute("aria-busy", "true");
  showStatus(bitcoin ? "Scanning Bitcoin address…" : "Scanning on-chain and market sources…");
  try {
    const response = await fetch("/api/sentinel/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ network: selected, address: value }),
      signal: AbortSignal.timeout(28000)
    });
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("The Sentinel service is unavailable.");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The Sentinel service is unavailable.");
    render(result);
    showStatus(result.cached ? "Showing a recent scan." : "Scan complete.");
  } catch (error) {
    showStatus(error.name === "TimeoutError" ? "The scan timed out. Please try again." :
      error instanceof TypeError ? "The Sentinel service is unavailable. Please try again." : error.message, true);
  } finally {
    button.disabled = network.disabled = address.disabled = false;
    form.removeAttribute("aria-busy");
  }
});
