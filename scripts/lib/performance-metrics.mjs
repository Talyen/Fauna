export function summarizeSample(sample) {
  if (
    !Array.isArray(sample.frames) ||
    sample.frames.length < 60 ||
    sample.frames.some((frame) => !Number.isFinite(frame) || frame <= 0)
  )
    throw new Error("Incomplete: fewer than 60 usable frame samples.");
  if (
    !sample.segments?.length ||
    sample.segments.some(
      (s) => !s.complete || !Number.isFinite(s.duration) || s.duration <= 0 || s.frames < 10,
    )
  )
    throw new Error("Incomplete action segment.");
  const sorted = [...sample.frames].sort((a, b) => a - b);
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return {
    frames: sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    gaps: Object.fromEntries([20, 33.3, 50, 100].map((n) => [n, sorted.filter((ms) => ms > n).length])),
    longTasks: sample.longTasks === null ? null : sample.longTasks.length,
    input: sample.input,
    before: sample.before,
    after: sample.after,
  };
}
export function comparePerformance(before, after) {
  if (
    before.format !== 1 ||
    after.format !== 1 ||
    !before.complete ||
    !after.complete ||
    JSON.stringify(before.environment) !== JSON.stringify(after.environment)
  )
    throw new Error("Incomplete or incompatible performance environment.");
  const rows = new Map(after.cases.map((row) => [row.id, row]));
  if (
    !before.cases.length ||
    rows.size !== after.cases.length ||
    new Set(before.cases.map((r) => r.id)).size !== before.cases.length ||
    rows.size !== before.cases.length
  )
    throw new Error("Performance case sets differ.");
  return before.cases.map((left) => {
    const right = rows.get(left.id);
    if (
      !right ||
      left.checkpointHash !== right.checkpointHash ||
      left.actionHash !== right.actionHash ||
      left.fixture !== right.fixture
    )
      throw new Error(`Incompatible performance case: ${left.id}`);
    const a = summarizeSample(left.sample),
      b = summarizeSample(right.sample);
    const rate = (sample, count) => (count / sample.frames.reduce((sum, n) => sum + n, 0)) * 30_000;
    return {
      id: left.id,
      baseline: a,
      treatment: b,
      p95Delta: b.p95 - a.p95,
      gapRatesPer30s: Object.fromEntries(
        [20, 33.3, 50, 100].map((n) => [
          n,
          { baseline: rate(left.sample, a.gaps[n]), treatment: rate(right.sample, b.gaps[n]) },
        ]),
      ),
    };
  });
}
