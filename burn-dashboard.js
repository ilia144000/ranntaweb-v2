// RANNTA Burn Dashboard — Automatic "Latest Burn" based on your wallet events

const RANNTA_MASTER = "EQBCY5Yj9G6VAQibTe6hz53j8vBNO234n0fzHUP3lUBBYbeR";
const BURN_ADDRESS = "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ";
const TOTAL_SUPPLY = 130000000000; // 130B RANNTA
const DECIMALS = 9;

// TODO: put your main wallet address here (the one you use to burn RANNTA)
const OFFICIAL_BURNER = "REPLACE_WITH_YOUR_MAIN_WALLET_ADDRESS";

const FALLBACK_BURNED = 6189267507.75;

let burnChartInstance = null;

function formatNumber(n) {
  return n.toLocaleString("en-US");
}

async function tonApi(path) {
  const url = "https://tonapi.io" + path;
  console.log("[TonAPI] GET", url);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  console.log("[TonAPI] status", res.status, "for", path);
  if (!res.ok) {
    throw new Error("TonAPI error " + res.status + " for " + path);
  }
  return res.json();
}

// 1) Total burned = jetton balance of burn address
async function getTotalBurned() {
  const data = await tonApi(`/v2/accounts/${BURN_ADDRESS}/jettons`);
  console.log("[TonAPI] jettons payload", data);

  const balances = data.balances || [];
  const rannta = balances.find(
    (b) => b.jetton && b.jetton.address === RANNTA_MASTER
  );

  if (!rannta) {
    console.warn("[Burn] No RANNTA balance found for burn address");
    return 0;
  }

  const raw = BigInt(rannta.balance);
  const amount = Number(raw) / Math.pow(10, DECIMALS);
  return amount;
}

// 2) Official burn events = jetton transfers from your wallet into burn address
async function getOfficialBurnEvents(limit = 200) {
  if (!OFFICIAL_BURNER || OFFICIAL_BURNER.startsWith("REPLACE_")) {
    console.warn("OFFICIAL_BURNER is not set");
    return [];
  }

  const eventsData = await tonApi(
    `/v2/accounts/${OFFICIAL_BURNER}/events?limit=${limit}`
  );
  console.log("[TonAPI] burner wallet events payload", eventsData);

  const items = eventsData.events || [];
  const burns = [];

  for (const ev of items) {
    const ts = ev.timestamp;
    const eventId = ev.event_id;
    const actions = ev.actions || [];

    for (const act of actions) {
      if (!act.jetton_transfer) continue;
      const jt = act.jetton_transfer;

      if (!jt.jetton || jt.jetton.address !== RANNTA_MASTER) continue;
      if (!jt.amount) continue;

      const raw = BigInt(jt.amount);
      const amount = Number(raw) / Math.pow(10, DECIMALS);

      const sender = jt.sender?.address || "";
      const receiver = jt.recipient?.address || "";

      if (receiver !== BURN_ADDRESS) continue;

      burns.push({
        txHash: eventId,
        timestamp: ts,
        amount,
        sender,
      });
    }
  }

  return burns;
}

// 3) Leaderboard
function buildLeaderboard(events) {
  const map = new Map();

  for (const ev of events) {
    const key = ev.sender || "unknown";
    const current =
      map.get(key) || { address: key, totalAmount: 0, burnCount: 0 };
    current.totalAmount += ev.amount;
    current.burnCount += 1;
    map.set(key, current);
  }

  const arr = Array.from(map.values());
  arr.sort((a, b) => b.totalAmount - a.totalAmount);
  return arr.slice(0, 20);
}

// 4) Summary cards (includes Latest Burn)
function renderSummary(totalBurned, latestBurn, totalSupply) {
  const totalBurnedEl = document.getElementById("totalBurned");
  const totalBurnedPercentEl = document.getElementById("totalBurnedPercent");
  const circSupplyEl = document.getElementById("circSupply");
  const totalSupplyEl = document.getElementById("totalSupply");
  const latestBurnEl = document.getElementById("latestBurn");

  if (totalBurnedEl) {
    totalBurnedEl.textContent = formatNumber(totalBurned) + " RANNTA";
  }

  const percent = (totalBurned / totalSupply) * 100;
  if (totalBurnedPercentEl) {
    totalBurnedPercentEl.textContent = percent.toFixed(3) + " %";
  }

  const circ = totalSupply - totalBurned;
  if (circSupplyEl) {
    circSupplyEl.textContent = formatNumber(circ) + " RANNTA";
  }

  if (totalSupplyEl) {
    totalSupplyEl.textContent = formatNumber(totalSupply) + " RANNTA";
  }

  if (latestBurnEl) {
    if (latestBurn) {
      const ts = new Date(latestBurn.timestamp * 1000);
      latestBurnEl.textContent =
        formatNumber(latestBurn.amount) +
        " RANNTA — " +
        ts.toISOString().split("T")[0];
    } else {
      latestBurnEl.textContent = "No burns detected yet";
    }
  }
}

// 5) Chart
function renderChart(events) {
  const ctx = document.getElementById("burnChart");
  if (!ctx) return;

  const sorted = events.slice().sort((a, b) => a.timestamp - b.timestamp);

  let cumulative = 0;
  const labels = [];
  const values = [];

  for (const ev of sorted) {
    cumulative += ev.amount;
    const d = new Date(ev.timestamp * 1000);
    labels.push(d.toISOString().split("T")[0]);
    values.push(cumulative);
  }

  if (burnChartInstance) {
    burnChartInstance.destroy();
  }

  if (typeof Chart === "undefined") {
    console.warn("Chart.js is not loaded, skipping chart rendering");
    return;
  }

  burnChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cumulative burned RANNTA (official burns)",
          data: values,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: true } },
    },
  });
}

// 6) Leaderboard
function renderLeaderboard(leaderboard) {
  const tbody = document.getElementById("burnLeaderboard");
  if (!tbody) return;

  if (!leaderboard || leaderboard.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No burn addresses yet.</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  leaderboard.forEach((entry, index) => {
    const tr = document.createElement("tr");

    const rankTd = document.createElement("td");
    rankTd.textContent = String(index + 1);

    const addrTd = document.createElement("td");
    const shortAddr =
      entry.address.slice(0, 5) + "…" + entry.address.slice(-5);
    addrTd.textContent = shortAddr;
    addrTd.title = entry.address;

    const totalTd = document.createElement("td");
    totalTd.textContent = formatNumber(entry.totalAmount);

    const countTd = document.createElement("td");
    countTd.textContent = String(entry.burnCount);

    tr.appendChild(rankTd);
    tr.appendChild(addrTd);
    tr.appendChild(totalTd);
    tr.appendChild(countTd);

    tbody.appendChild(tr);
  });
}

// 7) Recent burns
function renderHistory(events) {
  const ul = document.getElementById("burnHistory");
  if (!ul) return;

  if (!events || events.length === 0) {
    ul.innerHTML = "<li>No burn events yet.</li>";
    return;
  }

  ul.innerHTML = "";
  events
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)
    .forEach((ev) => {
      const li = document.createElement("li");
      const d = new Date(ev.timestamp * 1000);
      const senderShort = ev.sender
        ? ev.sender.slice(0, 5) + "…" + ev.sender.slice(-5)
        : "unknown";
      li.textContent =
        d.toISOString().replace("T", " ").split(".")[0] +
        " — " +
        formatNumber(ev.amount) +
        " RANNTA from " +
        senderShort;
      ul.appendChild(li);
    });
}

// 8) Bootstrap
async function bootstrapBurnDashboard() {
  try {
    const [totalBurnedReal, officialEvents] = await Promise.all([
      getTotalBurned(),
      getOfficialBurnEvents(200),
    ]);

    const totalBurned =
      totalBurnedReal && totalBurnedReal > 0
        ? totalBurnedReal
        : FALLBACK_BURNED;

    let latestBurn = null;
    if (officialEvents && officialEvents.length > 0) {
      latestBurn = officialEvents.reduce((latest, ev) =>
        !latest || ev.timestamp > latest.timestamp ? ev : latest
      , null);
    }

    const leaderboard = buildLeaderboard(officialEvents);

    renderSummary(totalBurned, latestBurn, TOTAL_SUPPLY);
    renderChart(officialEvents);
    renderLeaderboard(leaderboard);
    renderHistory(officialEvents);
  } catch (err) {
    console.error("Burn dashboard error:", err);
    renderSummary(FALLBACK_BURNED, null, TOTAL_SUPPLY);
    renderChart([]);
    renderLeaderboard([]);
    renderHistory([]);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("refreshBurn");
  if (btn) {
    btn.addEventListener("click", () => bootstrapBurnDashboard());
  }
  bootstrapBurnDashboard();
});
