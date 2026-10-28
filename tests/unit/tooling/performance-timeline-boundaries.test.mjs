import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  comparePerformance,
  compareRecorderOverhead,
  hitchMarkdown,
  hitchInventory,
  summarizeSample,
} from "../../../scripts/performance/metrics.mjs";
import { installSampler } from "../../../scripts/performance/sampler.mjs";
import { attributeTrace, beginTrace } from "../../../scripts/performance/trace.mjs";
import { timingReport } from "../../../scripts/ci/ci-timings.mjs";

afterEach(() => vi.unstubAllGlobals());

const sample = () => ({
  frames: Array.from({ length: 80 }, (_, index) => ({
    start: index * 16,
    end: (index + 1) * 16,
    duration: 16,
  })),
  focused: true,
  visibility: "visible",
  segments: [{ name: "play", start: 0, end: 1280, duration: 1280, frames: 80, complete: true }],
  longTasks: null,
  input: null,
});

it("rejects gaps omitted between recorded frames", () => {
  const input = sample();
  input.frames[30] = { start: 490, end: 496, duration: 6 };
  expect(() => summarizeSample(input)).toThrow("frame samples");
  const overlapping = sample();
  overlapping.frames[30] = { start: 479.995, end: 496, duration: 16.005 };
  expect(() => summarizeSample(overlapping)).toThrow("frame samples");
});

it("rejects negative frame timestamps on the renderer clock", () => {
  const input = sample();
  input.frames[0] = { start: -1, end: 16, duration: 17 };
  expect(() => summarizeSample(input)).toThrow("frame samples");
});

it("rejects overlapping action segments", () => {
  const input = sample();
  input.segments = [
    { name: "first", start: 0, end: 700, duration: 700, frames: 40, complete: true },
    { name: "second", start: 600, end: 1200, duration: 600, frames: 40, complete: true },
  ];
  expect(() => summarizeSample(input)).toThrow("action segment");
});

it("rejects action segments entirely outside the recorded frame timeline", () => {
  const input = sample();
  input.segments = [{ name: "play", start: 2000, end: 3000, duration: 1000, frames: 40, complete: true }];
  expect(() => summarizeSample(input)).toThrow("action segment");
});

it("rejects negative browser observer and semantic span timestamps", () => {
  const input = sample();
  expect(() => summarizeSample({ ...input, longTasks: [{ start: -1, duration: 10 }] })).toThrow("observer");
  expect(() => summarizeSample({ ...input, spans: [{ start: -1, end: 5 }] })).toThrow("span");
  expect(summarizeSample(input).frames).toBe(80);
});

it("reports malformed imported timelines as validation errors", () => {
  expect(() => summarizeSample(null)).toThrow("Invalid performance sample");
  for (const [field, error] of [
    ["frames", "frame samples"],
    ["longTasks", "observer"],
    ["input", "observer"],
    ["spans", "span"],
    ["segments", "action segment"],
  ]) {
    const input = sample();
    input[field] = field === "frames" ? [...input.frames] : [null];
    input[field][0] = null;
    expect(() => summarizeSample(input)).toThrow(error);
  }
  expect(() => summarizeSample({ ...sample(), segments: { length: 1 } })).toThrow("action segment");
});

it("uses nearest-rank percentiles without advancing one sample", () => {
  const input = sample();
  let end = 0;
  input.frames = Array.from({ length: 100 }, (_, i) => {
    const start = end;
    end += i + 1;
    return { start, end, duration: i + 1 };
  });
  input.segments = [{ start: 0, end, duration: end, frames: 100, complete: true }];
  expect(summarizeSample(input)).toMatchObject({ p50: 50, p95: 95, p99: 99 });
});

it("encodes report filenames so spaces, hashes and parentheses remain part of the link", () => {
  const markdown = hitchMarkdown("battle #1(test)", summarizeSample(sample()), null);
  expect(markdown).toContain("(battle%20%231%28test%29-sample.json)");
  expect(markdown).toContain("(battle%20%231%28test%29-summary.json)");
});

const traceFixture = (events) => ({
  traceEvents: [
    { name: "fauna-capture-start", pid: 1, tid: 1, ts: 1000 },
    ...events.map((event) => ({ pid: 1, tid: 1, ...event })),
    { name: "fauna-capture-end", pid: 1, tid: 1, ts: 11000 },
  ],
});
const attribute = (events) =>
  attributeTrace(traceFixture(events), { markerStart: 0, markerEnd: 10 }, [
    { start: 0, end: 10, duration: 10 },
  ]);

it("refuses attribution for unmatched begin or end events", () => {
  for (const ph of ["B", "E"])
    expect(attribute([{ name: "Layout", ph, ts: 2000 }])).toMatchObject({ available: false });
});

it("keeps unknown nested trace work out of classified CPU totals", () => {
  const result = attribute([
    { name: "FunctionCall", ph: "X", ts: 1000, dur: 10000 },
    { name: "UnknownNativeWork", ph: "X", ts: 3000, dur: 6000 },
    { name: "Layout", ph: "X", ts: 4000, dur: 2000 },
  ]);
  expect(result.available).toBe(true);
  expect(result.hitches[0].work).toEqual([
    expect.objectContaining({ category: "script", selfMs: 4 }),
    expect.objectContaining({ category: "style/layout", selfMs: 2 }),
  ]);
  expect(result.hitches[0].unaccountedMs).toBe(4);
});

it("preserves the innermost selection and stable ties without sorting each time slice", () => {
  const result = attribute([
    { name: "FunctionCall", ph: "X", ts: 1000, dur: 10000 },
    { name: "Layout", ph: "B", ts: 3000 },
    { name: "Paint", ph: "X", ts: 3000, dur: 4000 },
    { ph: "E", ts: 7000 },
  ]);
  expect(result.hitches[0].work).toEqual([
    expect.objectContaining({ category: "script", selfMs: 6 }),
    expect.objectContaining({ category: "paint", selfMs: 4 }),
  ]);
  expect(result.hitches[0].unaccountedMs).toBe(0);
});

function samplerEnvironment(failType) {
  let now = 0,
    serial = 0;
  const frames = new Map();
  const observers = [];
  const document = Object.assign(new EventTarget(), {
    querySelectorAll: () => [],
    visibilityState: "visible",
    hasFocus: () => true,
  });
  const window = new EventTarget();
  const motion = new EventTarget();
  const removals = [document, window, motion].map((target) => vi.spyOn(target, "removeEventListener"));
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  vi.stubGlobal("matchMedia", () => motion);
  vi.stubGlobal("performance", {
    now: () => now,
    timeOrigin: 0,
    mark: () => ({ startTime: now }),
    clearMarks: () => {},
  });
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    frames.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal("cancelAnimationFrame", (id) => frames.delete(id));
  vi.stubGlobal(
    "PerformanceObserver",
    class {
      static supportedEntryTypes = ["longtask", "event"];
      constructor() {
        this.disconnect = vi.fn();
        observers.push(this);
      }
      observe({ type }) {
        if (type === failType) throw new Error("Observer unavailable");
      }
      takeRecords() {
        return [];
      }
    },
  );
  return {
    window,
    frames,
    observers,
    removals,
    pump: () => {
      now += 16;
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(now);
    },
  };
}

it("retires previous sampler ownership before installing another capture", async () => {
  const env = samplerEnvironment();
  const first = installSampler();
  env.pump();
  env.pump();
  await first;
  const previous = env.window.faunaPerf;
  const next = installSampler();
  env.pump();
  env.pump();
  await next;
  try {
    expect(previous.sample.end).not.toBeNull();
    expect(env.observers.slice(0, 2).every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(
      true,
    );
    expect(env.frames.size).toBe(1);
    expect(() => previous.segment("late")).toThrow("lifecycle");
  } finally {
    env.window.faunaPerf.stop();
  }
  expect(env.frames.size).toBe(0);
});

it("rolls back observers and listeners when capture setup fails", async () => {
  const env = samplerEnvironment("event");
  await expect(installSampler()).rejects.toThrow("Observer unavailable");
  expect(env.observers).toHaveLength(2);
  expect(env.observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true);
  expect(env.removals.every((remove) => remove.mock.calls.length === 1)).toBe(true);
  expect(env.window.faunaPerformanceCapture).toBeUndefined();
  expect(env.frames.size).toBe(0);
});

it("reports invalid or reversed CI timestamps as unavailable rather than zero or NaN", () => {
  for (const completed_at of ["invalid", "2026-10-21T00:00:00Z"]) {
    const report = timingReport({ run_started_at: "2026-10-21T00:00:05Z" }, [
      {
        started_at: "2026-10-21T00:00:05Z",
        completed_at,
        steps: [],
      },
    ]);
    expect(report.jobs[0].executionSeconds).toBeNull();
    expect(report.activeElapsedSeconds).toBeNull();
    expect(report.runnerSeconds).toBe(0);
  }
});

it("summarizes queued CI jobs even when step details are not yet available", () => {
  const report = timingReport({}, [{ name: "queued", status: "queued" }]);
  expect(report.jobs[0]).toMatchObject({ name: "queued", steps: [], executionSeconds: null });
});

const report = (input = sample()) => ({
  format: 3,
  complete: true,
  environment: { runtime: "chromium" },
  cases: [
    { id: "battle", checkpointHash: "checkpoint", actionHash: "actions", fixture: "fixture", sample: input },
  ],
});

it("keeps strict hitch thresholds and normalized rates across all frame buckets", () => {
  const input = sample();
  let end = 0;
  input.frames = Array.from({ length: 80 }, (_, index) => {
    const start = end;
    const duration = [20, 33.3, 50, 100, 101][index % 5];
    end += duration;
    return { start, end, duration };
  });
  input.segments = [{ start: 0, end, duration: end, frames: 80, complete: true }];
  const summary = summarizeSample(input);
  expect(summary.gaps).toEqual({ 20: 64, 33.3: 48, 50: 32, 100: 16 });
  const [comparison] = comparePerformance(report(input), report(input));
  expect(comparison.p95Delta).toBe(0);
  for (const [threshold, count] of Object.entries(summary.gaps)) {
    expect(comparison.gapRatesPer30s[threshold].baseline).toBeCloseTo((count / end) * 30000);
    expect(comparison.gapRatesPer30s[threshold].treatment).toBe(
      comparison.gapRatesPer30s[threshold].baseline,
    );
  }
});

it("rejects absent imported reports with a useful comparison diagnostic", () => {
  expect(() => comparePerformance(null, report())).toThrow("performance environment");
  expect(() => comparePerformance(report(), null)).toThrow("performance environment");
});

it("requires a real build identity and explicit recording modes for overhead evidence", () => {
  for (const buildIdentity of [null, 42, {}, "", "  "]) {
    expect(() =>
      compareRecorderOverhead(
        { ...report(), buildIdentity, environment: { recordSpans: false } },
        { ...report(), buildIdentity, environment: { recordSpans: true } },
      ),
    ).toThrow("identical renderer build");
  }
  expect(() =>
    compareRecorderOverhead(
      { ...report(), buildIdentity: "build", environment: null },
      { ...report(), buildIdentity: "build" },
    ),
  ).toThrow("inactive then active");
  expect(
    compareRecorderOverhead(
      { ...report(), buildIdentity: "build", environment: { recordSpans: false } },
      { ...report(), buildIdentity: "build", environment: { recordSpans: true } },
    ).cases,
  ).toHaveLength(1);
});

it("reports missing or malformed trace payloads as unavailable", () => {
  for (const trace of [null, undefined, {}, { traceEvents: {} }])
    expect(attributeTrace(trace, { markerStart: 0, markerEnd: 10 }, [])).toMatchObject({ available: false });
});

it("refuses invalid hitch intervals instead of emitting invalid CPU accounting", () => {
  for (const gap of [
    null,
    { start: -1, end: 10, duration: 11 },
    { start: 0, end: 10, duration: NaN },
    { start: 0, end: 10, duration: 5 },
  ])
    expect(attributeTrace(traceFixture([]), { markerStart: 0, markerEnd: 10 }, [gap])).toMatchObject({
      available: false,
    });
  expect(
    attributeTrace(
      traceFixture([]),
      { markerStart: 0, markerEnd: 10 },
      Array.from({ length: 21 }, () => ({ start: 0, end: 10, duration: 10 })),
    ),
  ).toMatchObject({ available: false });
});

it("retains trace attribution at the work budget and rejects overflow", () => {
  const events = Array.from({ length: 1000 }, () => ({ name: "Layout", ph: "X", ts: 1000, dur: 10000 }));
  expect(attribute(events).hitches[0].work[0].selfMs).toBe(10);
  expect(attribute([...events, events[0]])).toMatchObject({
    available: false,
    reason: "Per-hitch attribution work budget exceeded",
  });
});

function traceClient({ startError, detachError, closeError, dataLossOccurred = false } = {}) {
  const client = new EventEmitter();
  client.detach = vi.fn(async () => {
    if (detachError) throw detachError;
  });
  client.send = vi.fn(async (method) => {
    if (method === "Tracing.start" && startError) throw startError;
    if (method === "Tracing.end")
      client.emit("Tracing.tracingComplete", { stream: "stream", dataLossOccurred });
    if (method === "IO.read") return { data: '{"traceEvents":[]}', eof: true };
    if (method === "IO.close" && closeError) throw closeError;
  });
  return { client, page: { context: () => ({ newCDPSession: async () => client }) } };
}

it("preserves trace setup failure when detaching also fails", async () => {
  const { page, client } = traceClient({
    startError: new Error("start failed"),
    detachError: new Error("detach failed"),
  });
  await expect(beginTrace(page, "unused")).rejects.toThrow("start failed");
  expect(client.detach).toHaveBeenCalledOnce();
});

it("preserves capture failures and reports every cleanup failure", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fauna-trace-test-"));
  try {
    const { page, client } = traceClient({
      dataLossOccurred: true,
      closeError: new Error("close failed"),
      detachError: new Error("detach failed"),
    });
    const stop = await beginTrace(page, path.join(directory, "trace.json"));
    const error = await stop().catch((error) => error);
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors.map((error) => error.message)).toEqual([
      "Trace dropped events or exhausted its buffer",
      "close failed",
      "detach failed",
    ]);
    expect(client.detach).toHaveBeenCalledOnce();
    expect(await stop()).toBeNull();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("keeps the original trace failure when partial evidence cannot be written", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fauna-trace-test-"));
  try {
    const { page, client } = traceClient({ dataLossOccurred: true });
    const stop = await beginTrace(page, path.join(directory, "missing", "trace.json"));
    const error = await stop().catch((error) => error);
    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors[0].message).toContain("Trace dropped events");
    expect(error.errors[1].code).toBe("ENOENT");
    expect(client.detach).toHaveBeenCalledOnce();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("orders CI timestamps by instant even when their timezone offsets differ", () => {
  const result = timingReport({ run_started_at: "2026-10-20T22:00:00Z" }, [
    { started_at: "2026-10-21T00:00:00Z", completed_at: "2026-10-21T00:30:00Z" },
    { started_at: "2026-10-21T01:00:00+02:00", completed_at: "2026-10-21T01:30:00+02:00" },
  ]);
  expect(result.initialQueueSeconds).toBe(3600);
  expect(result.activeElapsedSeconds).toBe(5400);
  expect(result.elapsedSeconds).toBe(9000);
});

it("retains exactly the twenty largest hitches in stable order without changing the timeline", () => {
  const input = sample();
  let end = 0;
  input.frames = Array.from({ length: 80 }, (_, index) => {
    const start = end;
    const duration = 16 + (index % 27);
    end += duration;
    return { start, end, duration };
  });
  const original = structuredClone(input.frames);
  const expected = input.frames
    .filter((frame) => frame.duration > 20)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20);
  expect(hitchInventory(input).map(({ start, end, duration }) => ({ start, end, duration }))).toEqual(
    expected,
  );
  expect(input.frames).toEqual(original);
  expect(hitchInventory(sample())).toEqual([]);
});
