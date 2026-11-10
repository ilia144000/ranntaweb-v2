export const sections = Object.freeze({
  control: "Contract control", trading: "Trading safety", liquidity: "Liquidity",
  holders: "Holder distribution"
});

const levels = ["LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL"];
export const policy = Object.freeze({
  version: "sentinel-1",
  levels: levels.map((label, index) => ({ label, max: (index + 1) * 20 })),
  minimumGroups: 3,
  maximum: 100
});

export function score(findings, assetConfirmed) {
  const groups = new Set();
  const penalties = [];
  for (const finding of findings) {
    if (finding.status !== "UNKNOWN" && finding.status !== "NOT APPLICABLE" && rules[finding.id].warning > 0) {
      groups.add(finding.section);
    }
    if (finding.points > 0) penalties.push({ id: finding.id, label: finding.label, points: finding.points });
  }
  const evidencedPoints = Math.min(policy.maximum, penalties.reduce((sum, item) => sum + item.points, 0));
  const sufficient = assetConfirmed && groups.has("control") && groups.size >= policy.minimumGroups;
  return {
    value: sufficient ? evidencedPoints : null,
    level: sufficient ? policy.levels.find(level => evidencedPoints <= level.max).label : "INSUFFICIENT EVIDENCE",
    evidencedPoints, penalties, coveredGroups: groups.size, totalGroups: Object.keys(sections).length,
    warnings: findings.filter(finding => finding.status === "WARNING").length,
    critical: findings.filter(finding => finding.status === "HIGH RISK").length,
    unknown: findings.filter(finding => finding.status === "UNKNOWN").length
  };
}

const rule = (section, label, warning, high, explanation) => ({ section, label, warning, high, explanation });
export const rules = Object.freeze({
  verification: rule("control", "Source verification", 0, 0, "Verification matches published source to bytecode; it does not certify behavior."),
  owner: rule("control", "Owner / renunciation", 7, 7, "An active owner can use any controls granted by the contract. A zero owner does not rule out roles, proxies or other admins."),
  proxy: rule("control", "Proxy / upgradeability", 14, 14, "An upgrade mechanism can change token behavior after a scan."),
  mint: rule("control", "Mint / supply modification", 14, 14, "Additional supply can dilute existing holders."),
  pause: rule("control", "Pause controls", 8, 8, "An authorized account may halt transfers."),
  deny: rule("control", "Blacklist / freeze", 10, 10, "An authorized account may block or freeze selected accounts."),
  allow: rule("trading", "Whitelist restrictions", 8, 8, "Allowlist logic may give different accounts different trading permissions."),
  transfer: rule("trading", "Transfer / trade activation", 8, 15, "Transfer gating can limit when or how a holder moves tokens."),
  limits: rule("trading", "Transaction / wallet limits", 5, 5, "Limits can restrict trade size or holdings; an identified interface does not establish the configured limit."),
  tax: rule("trading", "Buy and sell taxes", 10, 22, "Reported DEX taxes of at least 5% or 20% raise execution costs. The larger verified side determines the single penalty."),
  transferFee: rule("trading", "Transfer fee", 8, 16, "An enabled transfer fee reduces received proceeds. A configured fee of at least 20% receives the higher penalty."),
  feeControl: rule("trading", "Fee modification", 8, 8, "Mutable fees can change trade or transfer costs after the scan."),
  honeypot: rule("trading", "Honeypot / sell restrictions", 20, 45, "Sell restrictions can prevent a holder from exiting a position. Provider checks cover only their observed conditions."),
  methods: rule("control", "Other privileged method signals", 6, 6, "Named ABI entry points can indicate capabilities. ABI names do not prove authorization or execution behavior."),
  external: rule("control", "Suspicious external calls", 0, 0, "Assessing arbitrary external call paths requires deeper execution or bytecode analysis."),
  program: rule("control", "Token program", 0, 0, "The governing program determines which authority and extension checks apply."),
  extensions: rule("control", "Token-2022 extensions", 0, 0, "Extensions change token behavior; specific risks are scored in their own findings."),
  delegate: rule("control", "Permanent delegate", 18, 18, "A permanent delegate can transfer or burn tokens from other accounts."),
  hook: rule("trading", "Transfer hook", 12, 12, "The token can invoke a separate program on transfers, which may enforce additional rules."),
  metadata: rule("control", "Metadata update authority", 4, 4, "An active authority can update token metadata; this does not confer control of balances."),
  liquidity: rule("liquidity", "Observed DEX liquidity", 10, 20, "Tracked liquidity below $100,000, or below $10,000 at the higher level, can make exits more sensitive to size. Untracked liquidity is unknown."),
  pools: rule("liquidity", "Pool liquidity concentration", 5, 5, "A single pool holding at least 95% of observed DEX liquidity creates reliance on that venue."),
  lp: rule("liquidity", "LP ownership concentration", 10, 10, "A reported unlocked LP holder with at least 50% of the reported pool supply may influence withdrawable liquidity."),
  holders: rule("holders", "Top holder / account concentration", 8, 16, "A reported address with at least 20% or 50% of supply can represent concentration; custody, burn and program accounts may affect interpretation."),
  creator: rule("holders", "Creator / deployer holdings", 8, 16, "A reported creator holding at least 10% or 25% of supply can exert concentrated influence.")
});

export function findingsFrom(evidence, ids) {
  return ids.map(id => {
    const rule = rules[id];
    const item = evidence[id] ?? {
      status: "UNKNOWN", source: "Coverage", detail: "No supported observation was available for this check."
    };
    const points = item.status === "HIGH RISK" ? rule.high : item.status === "WARNING" ? rule.warning : 0;
    return { id, section: rule.section, label: rule.label, status: item.status, source: item.source,
      detail: item.detail, explanation: rule.explanation, points };
  });
}
