import { pairedStats, validateBalanceMetrics } from "./paired-balance.mjs";

const MIN_SAMPLES = 5;
const SEVERITY = { critical: 0, review: 1, watch: 2 };
export function rankBalanceFindings(report) {
  if (report.format !== 1 || !["career", "experiment", "comparison"].includes(report.kind))
    throw new Error("Unsupported balance report.");
  const findings = [];
  const add = (severity, id, title, detail, evidence, magnitude = 0) =>
    findings.push({ severity, id, title, detail, evidence, magnitude });
  if (report.kind === "comparison") {
    if (!Array.isArray(report.pairs) || !report.pairs.length) throw new Error("Missing paired evidence.");
    if (report.pairs.some((pair) => !pair || typeof pair.key !== "string" || !pair.key.trim()))
      throw new Error("Invalid paired evidence identity.");
    if (new Set(report.pairs.map((pair) => pair.key)).size !== report.pairs.length)
      throw new Error("Duplicate paired evidence.");
    for (const pair of report.pairs) {
      validateBalanceMetrics(pair.baseline, pair.key);
      validateBalanceMetrics(pair.treatment, pair.key);
    }
    // Recalculate uncertainty from samples rather than trusting serialized summaries.
    for (const [metric, threshold, label] of [
      ["win", 0.2, "Journey success"],
      ["turns", 5, "Turns"],
      ["health", 5, "Remaining Health"],
      ["currency", 20, "Retained Gold"],
      ["xp", 5, "Keyword XP"],
    ]) {
      const stats = pairedStats(
        report.pairs.map((pair) => pair.treatment?.[metric] - pair.baseline?.[metric]),
      );
      if (Math.abs(stats.mean) < threshold) continue;
      const supported = stats.n >= MIN_SAMPLES && !stats.noisy;
      add(
        supported ? "review" : "watch",
        `paired-${metric}`,
        `${label} changed`,
        `Treatment minus baseline: ${stats.mean.toFixed(2)}; ${stats.n} pairs; standard error ${stats.standardError === null ? "unavailable" : stats.standardError.toFixed(2)}. ${supported ? "Above the review threshold and two standard errors." : "Limited or noisy evidence; collect more matched seeds."}`,
        report.pairs.map((pair) => ({ key: pair.key, files: pair.evidence })),
        Math.abs(stats.mean) / threshold,
      );
    }
  } else {
    if (
      typeof report.complete !== "boolean" ||
      !Array.isArray(report.cases) ||
      !Array.isArray(report.failures) ||
      report.cases.some((row) => !row || typeof row.complete !== "boolean")
    )
      throw new Error("Invalid balance cases or completion status.");
    if (!report.complete)
      add(
        "critical",
        "incomplete",
        "Incomplete balance evidence",
        "Stalls, rejected commands and watchdog failures are incomplete evidence, never defeats. Resolve these before tuning.",
        report.failures,
        report.failures.length,
      );
    if (
      report.complete &&
      (!report.cases.length || report.failures.length || report.cases.some((row) => !row.complete))
    )
      throw new Error("Contradictory completion evidence.");
    if (report.cases.some((row) => typeof row.key !== "string" || !row.key.trim()))
      throw new Error("Invalid balance case identity.");
    const keys = report.cases.map((row) => JSON.stringify([row.arm ?? "", row.key]));
    if (new Set(keys).size !== keys.length) throw new Error("Duplicate balance cases.");
    const groups = new Map();
    if (report.kind === "career") {
      const unconfirmed = report.cases.filter(
        (row) => typeof row.actualStarter !== "string" || row.actualStarter !== row.starter,
      );
      if (unconfirmed.length)
        add(
          "watch",
          "starter-coverage",
          "Starter preferences do not establish starter coverage",
          `${unconfirmed.length} of ${report.cases.length} cases did not confirm the preferred starter was drafted. Fallback or unrecorded drafts are excluded from starter summaries; inspect actualStarter and collect offered starts before comparing species.`,
          unconfirmed.map((row) => ({ key: row.key, files: [row.evidence] })),
        );
    }
    for (const row of report.cases) {
      if (!row.complete) continue;
      validateBalanceMetrics(row.metrics, row.key);
      if (report.kind !== "career") continue;
      if (typeof row.actualStarter !== "string" || row.actualStarter !== row.starter) continue;
      const starter = row.starter ?? row.key.replace(/-\d+$/, "");
      if (!groups.has(starter)) groups.set(starter, []);
      groups.get(starter).push(row);
    }
    const summaries = [];
    for (const [starter, rows] of groups) {
      const wins = pairedStats(rows.map((row) => row.metrics.win));
      const turns = pairedStats(rows.map((row) => row.metrics.turns));
      const evidence = rows.map((row) => ({ key: row.key, files: [row.evidence] }));
      const seeds = rows.map((row) => {
        const value = String(row.seed ?? row.key.match(/-(\d+)$/)?.[1] ?? "");
        const seed = Number(value);
        return /^\d+$/.test(value) && Number.isSafeInteger(seed) && seed <= 0xffffffff ? seed : null;
      });
      if (seeds.includes(null) || new Set(seeds).size !== seeds.length)
        throw new Error(`Missing or duplicate career seeds: ${starter}`);
      const seedSignature = JSON.stringify(seeds.sort((a, b) => a - b));
      summaries.push({ starter, wins, evidence, seedSignature });
      if (rows.length < MIN_SAMPLES) {
        add(
          "watch",
          `${starter}-samples`,
          `${starter}: small sample`,
          `${rows.length} completed journeys; use at least ${MIN_SAMPLES} distinct seeds before ranking balance effects.`,
          evidence,
        );
        continue;
      }
      if (wins.mean === 0 || wins.mean === 1)
        add(
          "watch",
          `${starter}-extreme`,
          `${starter}: ${wins.mean === 0 ? "no" : "all"} journeys won`,
          `${rows.length} completed seeds. Extreme policy outcomes merit inspection; they do not establish a human win rate.`,
          evidence,
          1,
        );
      if (turns.mean > 120)
        add(
          "review",
          `${starter}-length`,
          `${starter}: long journeys`,
          `Mean ${turns.mean.toFixed(1)} turns across ${rows.length} completed seeds, above the 120-turn journey review threshold. Compare encounter and outcome before changing tuning.`,
          evidence,
          turns.mean / 120,
        );
      if (rows.every((row) => row.metrics.xp === 0))
        add(
          "review",
          `${starter}-xp`,
          `${starter}: no retained keyword XP`,
          `${rows.length} completed journeys earned no retained XP. Inspect accepted plays and banking.`,
          evidence,
          1,
        );
    }
    // An approximate two-standard-error filter suppresses visibly noisy starter comparisons.
    // Extreme rates remain watch findings because a zero sample variance is not certainty.
    for (let i = 0; i < summaries.length; i++)
      for (let j = i + 1; j < summaries.length; j++) {
        const left = summaries[i];
        const right = summaries[j];
        if (left.seedSignature !== right.seedSignature) continue;
        const delta = left.wins.mean - right.wins.mean;
        if (left.wins.n < MIN_SAMPLES || right.wins.n < MIN_SAMPLES || Math.abs(delta) < 0.25) continue;
        const se = Math.sqrt(left.wins.standardError ** 2 + right.wins.standardError ** 2);
        if (Math.abs(delta) <= 2 * se) continue;
        const extreme = [left.wins.mean, right.wins.mean].some((rate) => rate === 0 || rate === 1);
        add(
          extreme ? "watch" : "review",
          `${left.starter}-${right.starter}-spread`,
          "Starter success differs",
          `${left.starter}: ${(left.wins.mean * 100).toFixed(0)}%; ${right.starter}: ${(right.wins.mean * 100).toFixed(0)}%. Spread exceeds 25 percentage points and two approximate standard errors; inspect matched seeds and matchups.`,
          [...left.evidence, ...right.evidence],
          Math.abs(delta) / 0.25,
        );
      }
  }
  findings.sort(
    (a, b) =>
      SEVERITY[a.severity] - SEVERITY[b.severity] || b.magnitude - a.magnitude || a.id.localeCompare(b.id),
  );
  return {
    format: 1,
    sourceKind: report.kind,
    identity: report.identity ?? report.treatmentIdentity,
    baselineIdentity: report.baselineIdentity,
    findings: findings.map((finding, index) => ({ rank: index + 1, ...finding })),
    limitations:
      "Automated policy observations, not human balance. Thresholds are review heuristics, not acceptance gates. Small or noisy samples remain watch items. No findings does not establish balanced content.",
  };
}
export function findingsMarkdown(result) {
  const evidence = (entries) =>
    entries
      .map((entry) => {
        const files = entry.files ?? [entry.evidence, entry.config, entry.journal].filter(Boolean);
        const links = files
          .filter((file) => typeof file === "string")
          .map(
            (file, i) =>
              `[evidence ${i + 1}](<${encodeURI(file).replaceAll("#", "%23").replaceAll("?", "%3F").replaceAll("<", "%3C").replaceAll(">", "%3E")}>)`,
          )
          .join(", ");
        return `- ${entry.key ?? "case"}${entry.reason ? `: ${entry.reason}` : ""}${links ? ` — ${links}` : ""}`;
      })
      .join("\n");
  return (
    `# Balance findings\n\n${result.limitations}\n\n` +
    (result.findings.length
      ? result.findings
          .map(
            (finding) =>
              `## ${finding.rank}. [${finding.severity}] ${finding.title}\n\n${finding.detail}\n\n${evidence(finding.evidence)}\n`,
          )
          .join("\n")
      : "No findings crossed the review thresholds.\n")
  );
}
