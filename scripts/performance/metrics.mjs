import { isDeepStrictEqual } from "node:util";

export function summarizeSample(sample) {
  if (!sample || typeof sample !== "object") throw new Error("Invalid performance sample.");
  if (
    !Array.isArray(sample.frames) ||
    sample.frames.length < 60 ||
    sample.frames.length > 12000 ||
    sample.frames.some(
      (frame, index) =>
        !frame ||
        !Number.isFinite(frame.start) ||
        frame.start < 0 ||
        !Number.isFinite(frame.end) ||
        !Number.isFinite(frame.duration) ||
        frame.duration <= 0 ||
        Math.abs(frame.end - frame.start - frame.duration) > 0.01 ||
        (index > 0 &&
          (frame.start < sample.frames[index - 1].end || frame.start - sample.frames[index - 1].end > 0.01)),
    )
  )
    throw new Error("Incomplete: fewer than 60 usable frame samples.");
  if (sample.truncated || sample.interrupted || sample.focused !== true || sample.visibility !== "visible")
    throw new Error("Incomplete or interrupted foreground timeline.");
  if (sample.startupMs != null && (!Number.isFinite(sample.startupMs) || sample.startupMs < 0))
    throw new Error("Invalid startup measurement.");
  const observations = [sample.longTasks, sample.input, sample.longAnimationFrames ?? null];
  if (
    observations.some(
      (entries) =>
        entries !== null &&
        (!Array.isArray(entries) ||
          entries.length > 12000 ||
          entries.some(
            (entry) =>
              !entry ||
              !Number.isFinite(entry.start) ||
              entry.start < 0 ||
              !Number.isFinite(entry.duration) ||
              entry.duration < 0 ||
              !Number.isFinite(entry.start + entry.duration) ||
              (entry.inputDelay != null && (!Number.isFinite(entry.inputDelay) || entry.inputDelay < 0)),
          )),
    )
  )
    throw new Error("Invalid observer timeline.");
  if (
    !Array.isArray(sample.spans ?? []) ||
    (sample.spans ?? []).some(
      (span) =>
        !span ||
        !Number.isFinite(span.start) ||
        span.start < 0 ||
        !Number.isFinite(span.end) ||
        span.end < span.start,
    ) ||
    (sample.spans?.length ?? 0) > 12000
  )
    throw new Error("Invalid semantic span timeline.");
  if (
    !Array.isArray(sample.segments) ||
    !sample.segments.length ||
    sample.segments.some(
      (s, index) =>
        !s ||
        s.complete !== true ||
        !Number.isFinite(s.start) ||
        s.start < 0 ||
        !Number.isFinite(s.end) ||
        !Number.isFinite(s.duration) ||
        Math.abs(s.end - s.start - s.duration) > 0.1 ||
        s.end <= s.start ||
        s.duration <= 0 ||
        (index > 0 && s.start < sample.segments[index - 1].end) ||
        s.end <= sample.frames[0].start ||
        s.start >= sample.frames[sample.frames.length - 1].end ||
        !Number.isSafeInteger(s.frames) ||
        s.frames < 10 ||
        s.frames > sample.frames.length,
    )
  )
    throw new Error("Incomplete action segment.");
  const sorted = sample.frames.map((frame) => frame.duration).sort((a, b) => a - b);
  // Nearest-rank percentiles select the first sample at or above the requested rank.
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
  return {
    hitches: hitchInventory(sample),
    startupMs: sample.startupMs ?? null,
    frames: sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    gaps: Object.fromEntries([20, 33.3, 50, 100].map((n) => [n, sorted.filter((ms) => ms > n).length])),
    longTasks: sample.longTasks === null ? null : sample.longTasks.length,
    input: sample.input,
    before: sample.before,
    after: sample.after,
    nativeMemory: sample.nativeMemory ?? null,
  };
}
export function comparePerformance(before, after) {
  if (
    before.format !== 3 ||
    after.format !== 3 ||
    before.complete !== true ||
    after.complete !== true ||
    !before.environment ||
    typeof before.environment !== "object" ||
    Array.isArray(before.environment) ||
    !after.environment ||
    typeof after.environment !== "object" ||
    Array.isArray(after.environment) ||
    !isDeepStrictEqual(before.environment, after.environment)
  )
    throw new Error("Incomplete or incompatible performance environment.");
  const validCase = (row) =>
    row &&
    [row.id, row.checkpointHash, row.actionHash, row.fixture].every(
      (value) => typeof value === "string" && value.length > 0,
    );
  if (
    !Array.isArray(before.cases) ||
    !Array.isArray(after.cases) ||
    !before.cases.every(validCase) ||
    !after.cases.every(validCase)
  )
    throw new Error("Performance case identity is incomplete.");
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
    const rate = (sample, count) =>
      (count / sample.frames.reduce((sum, frame) => sum + frame.duration, 0)) * 30_000;
    return {
      id: left.id,
      baseline: a,
      treatment: b,
      p95Delta: b.p95 - a.p95,
      startupDelta: a.startupMs === null || b.startupMs === null ? null : b.startupMs - a.startupMs,
      gapRatesPer30s: Object.fromEntries(
        [20, 33.3, 50, 100].map((n) => [
          n,
          { baseline: rate(left.sample, a.gaps[n]), treatment: rate(right.sample, b.gaps[n]) },
        ]),
      ),
    };
  });
}

const overlaps = (entry, gap) =>
  entry.start < gap.end && (entry.end ?? entry.start + entry.duration) > gap.start;
export function hitchInventory(sample) {
  return sample.frames
    .filter((frame) => frame.duration > 20)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20)
    .map((gap) => ({
      ...gap,
      actions: sample.segments.filter((segment) => overlaps(segment, gap)).map((segment) => segment.name),
      spans: (sample.spans ?? [])
        .filter((span) => overlaps(span, gap))
        .map((span) => ({ name: span.name, details: span.details, outcome: span.outcome })),
      longTasks: sample.longTasks === null ? null : sample.longTasks.filter((entry) => overlaps(entry, gap)),
      input: sample.input === null ? null : sample.input.filter((entry) => overlaps(entry, gap)),
      longAnimationFrames:
        sample.longAnimationFrames == null
          ? null
          : sample.longAnimationFrames.filter((entry) => overlaps(entry, gap)),
    }));
}
export function hitchMarkdown(id, summary, trace) {
  const safe = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
  const fileId = encodeURIComponent(id).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  const rows = summary.hitches.map((gap, index) => {
    const work = trace?.available ? trace.hitches[index] : null;
    return `| ${gap.start.toFixed(1)}–${gap.end.toFixed(1)} | ${gap.duration.toFixed(1)} ms | ${safe(gap.actions.join(", ") || "between actions")} | ${safe([...new Set(gap.spans.map((span) => span.name))].join(", ") || "unattributed")} | ${
      work
        ? safe(
            work.work
              .slice(0, 3)
              .map((entry) => `${entry.name}: ${entry.selfMs.toFixed(1)} ms`)
              .join("; "),
          ) + `; unexplained ${work.unaccountedMs.toFixed(1)} ms`
        : "Trace unavailable"
    } |`;
  });
  return `# ${safe(id)} hitch evidence\n\n[Raw timeline](${fileId}-sample.json) · [Summary](${fileId}-summary.json)${trace?.available ? ` · [Deep trace](${fileId}-trace.json)` : ""}\n\nIntervals share the renderer clock. Overlapping spans are context, not additive CPU totals or proof of a cause. Unsupported browser observations are unavailable, not zero. Trace timings include diagnostic overhead.\n\n| Interval (ms) | Gap | Action | Overlapping work | Trace observations |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n${rows.length ? "" : "\nNo frame gaps above 20 ms were observed\n"}`;
}

export function compareRecorderOverhead(inactive, active) {
  if (!inactive.buildIdentity || inactive.buildIdentity !== active.buildIdentity)
    throw new Error("Recorder overhead requires the identical renderer build");
  if (inactive.environment.recordSpans !== false || active.environment.recordSpans !== true)
    throw new Error("Overhead comparison requires inactive then active span recording");
  return {
    kind: "recorder-overhead",
    note: "Diagnostic recording overhead, not optimization evidence",
    cases: comparePerformance(
      { ...inactive, environment: { ...inactive.environment, recordSpans: true } },
      active,
    ),
  };
}
