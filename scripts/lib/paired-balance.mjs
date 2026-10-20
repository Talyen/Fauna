const METRICS = ["win", "turns", "health", "encounter", "swaps", "currency", "xp"];
export function pairedStats(deltas) {
  if (!deltas.length || deltas.some((value) => !Number.isFinite(value)))
    throw new Error("Invalid paired samples.");
  const n = deltas.length,
    mean = deltas.reduce((a, b) => a + b, 0) / n;
  const standardError =
    n > 1 ? Math.sqrt(deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (n - 1) / n) : null;
  return { n, mean, standardError, noisy: standardError === null || Math.abs(mean) <= 2 * standardError };
}
export function compareBalance(baseline, treatment) {
  if (
    baseline.format !== 1 ||
    treatment.format !== 1 ||
    !baseline.complete ||
    !treatment.complete ||
    baseline.kind !== treatment.kind ||
    JSON.stringify(baseline.settings) !== JSON.stringify(treatment.settings)
  )
    throw new Error("Incomplete or incompatible balance reports.");
  if (
    !Array.isArray(baseline.cases) ||
    !baseline.cases.length ||
    baseline.cases.length !== treatment.cases?.length
  )
    throw new Error("Case sets differ.");
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
      !left.complete ||
      !right.complete ||
      left.baseHash !== right.baseHash ||
      (baseline.kind === "career" && left.initialHash !== right.initialHash)
    )
      throw new Error(`Incomplete/incompatible pair: ${left.key}`);
    for (const metric of METRICS)
      if (!Number.isFinite(left.metrics?.[metric]) || !Number.isFinite(right.metrics?.[metric]))
        throw new Error(`Invalid metric: ${metric}`);
    return {
      key: left.key,
      baseline: left.metrics,
      treatment: right.metrics,
      evidence: [left.evidence, right.evidence],
    };
  });
  return {
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
