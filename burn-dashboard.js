// RANNTA Burn Dashboard — SIMPLE STATIC MODE
// Numbers synced with DYOR.io snapshot

const TOTAL_SUPPLY = 130000000000;              // 130B RANNTA
const TOTAL_BURNED = 76253036713.52;           // 76,253,036,713.52 RANNTA (burned)
const DECIMALS = 9;

function formatNumber(n) {
  return n.toLocaleString("en-US");
}

function renderBurnDashboard() {
  const totalBurnedEl = document.getElementById("totalBurned");
  const totalBurnedPercentEl = document.getElementById("totalBurnedPercent");
  const circSupplyEl = document.getElementById("circSupply");
  const totalSupplyEl = document.getElementById("totalSupply");
  const latestBurnEl = document.getElementById("latestBurn");

  // Burned amount
  if (totalBurnedEl) {
    totalBurnedEl.textContent = formatNumber(TOTAL_BURNED) + " RANNTA";
  }

  // Burned %
  const percent = (TOTAL_BURNED / TOTAL_SUPPLY) * 100;
  if (totalBurnedPercentEl) {
    totalBurnedPercentEl.textContent = percent.toFixed(2) + " %";
  }

  // Circulating supply = total - burned
  const circulating = TOTAL_SUPPLY - TOTAL_BURNED;
  if (circSupplyEl) {
    circSupplyEl.textContent = formatNumber(circulating) + " RANNTA";
  }

  // Total supply
  if (totalSupplyEl) {
    totalSupplyEl.textContent = formatNumber(TOTAL_SUPPLY) + " RANNTA";
  }

  // Latest burn text (manual mode)
  if (latestBurnEl) {
    latestBurnEl.textContent =
      "Synced with DYOR.io — Phoenix Burn Phase 1 (manual update)";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderBurnDashboard();

  // Refresh button just re-renders the same snapshot
  const btn = document.getElementById("refreshBurn");
  if (btn) {
    btn.addEventListener("click", () => renderBurnDashboard());
  }
});
