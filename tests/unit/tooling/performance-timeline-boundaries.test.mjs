import { afterEach, expect, it, vi } from "vitest";
import { hitchMarkdown, summarizeSample } from "../../../scripts/performance/metrics.mjs";
import { installSampler } from "../../../scripts/performance/sampler.mjs";
import { attributeTrace } from "../../../scripts/performance/trace.mjs";
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
