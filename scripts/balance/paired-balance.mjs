import { isDeepStrictEqual } from "node:util";

const METRICS = ["win", "turns", "health", "encounter", "swaps", "currency", "xp"];
export function validateBalanceMetrics(metrics, context) {
  for (const metric of METRICS)
    if (!Number.isSafeInteger(metrics?.[metric]))
      throw new Error(`Invalid metric: ${metric}${context ? ` (${context})` : ""}`);
  if (
    ![0, 1].includes(metrics.win) ||
    metrics.turns < 1 ||
    metrics.health < 0 ||
    metrics.encounter < 0 ||
    metrics.swaps < 0 ||
    metrics.xp < 0
  )
    throw new Error(`Invalid metrics${context ? ` (${context})` : ""}.`);
}
export function pairedStats(deltas) {
  if (!Array.isArray(deltas) || !deltas.length) throw new Error("Invalid paired samples.");
  for (const value of deltas) if (!Number.isFinite(value)) throw new Error("Invalid paired samples.");
  const n = deltas.length,
    mean = deltas.reduce((a, b) => a + b, 0) / n;
  const standardError =
    n > 1 ? Math.sqrt(deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (n - 1) / n) : null;
  if (!Number.isFinite(mean) || (standardError !== null && !Number.isFinite(standardError)))
    throw new Error("Paired statistics exceed the supported numeric range.");
  return { n, mean, standardError, noisy: standardError === null || Math.abs(mean) <= 2 * standardError };
}
export function compareBalance(baseline, treatment) {
  const nonempty = (value) => typeof value === "string" && value.length > 0;
  const settings = (value) => value && typeof value === "object" && !Array.isArray(value);
  if (
    baseline.format !== 1 ||
    treatment.format !== 1 ||
    baseline.complete !== true ||
    treatment.complete !== true ||
    (baseline.failures !== undefined &&
      (!Array.isArray(baseline.failures) || baseline.failures.length > 0)) ||
    (treatment.failures !== undefined &&
      (!Array.isArray(treatment.failures) || treatment.failures.length > 0)) ||
    !["career", "experiment"].includes(baseline.kind) ||
    baseline.kind !== treatment.kind ||
    !nonempty(baseline.identity) ||
    !nonempty(treatment.identity) ||
    !settings(baseline.settings) ||
    !settings(treatment.settings) ||
    !isDeepStrictEqual(baseline.settings, treatment.settings)
  )
    throw new Error("Incomplete or incompatible balance reports.");
  if (
    !Array.isArray(baseline.cases) ||
    !Array.isArray(treatment.cases) ||
    !baseline.cases.length ||
    baseline.cases.length !== treatment.cases?.length
  )
    throw new Error("Case sets differ.");
  if (
    !baseline.cases.every((row) => row && typeof row === "object") ||
    !treatment.cases.every((row) => row && typeof row === "object")
  )
    throw new Error("Invalid balance cases.");
  const keyed = new Map(treatment.cases.map((row) => [row.key, row]));
  if (
    keyed.size !== treatment.cases.length ||
    new Set(baseline.cases.map((r) => r.key)).size !== baseline.cases.length
  )
    throw new Error("Duplicate balance case.");
  const pairs = baseline.cases.map((left) => {
    const right = keyed.get(left.key);
    if (
      !right ||
      left.complete !== true ||
      right.complete !== true ||
      !nonempty(left.key) ||
      !nonempty(left.baseHash) ||
      !nonempty(right.baseHash) ||
      (baseline.kind === "career" && (!nonempty(left.initialHash) || !nonempty(right.initialHash))) ||
      left.baseHash !== right.baseHash ||
      (baseline.kind === "career" && left.initialHash !== right.initialHash)
    )
      throw new Error(`Incomplete/incompatible pair: ${left.key}`);
    validateBalanceMetrics(left.metrics, left.key);
    validateBalanceMetrics(right.metrics, right.key);
    return {
      key: left.key,
      baseline: left.metrics,
      treatment: right.metrics,
      evidence: [left.evidence, right.evidence],
    };
  });
  return {
    format: 1,
    kind: "comparison",
    baselineIdentity: baseline.identity,
    treatmentIdentity: treatment.identity,
    codeChanged: baseline.identity !== treatment.identity,
    pairs,
    metrics: Object.fromEntries(
      METRICS.map((key) => [key, pairedStats(pairs.map((p) => p.treatment[key] - p.baseline[key]))]),
    ),
    limitations:
      "Automated policy observations, not human win rates. Standard errors describe paired variation; one pair cannot establish uncertainty.",
  };
}
