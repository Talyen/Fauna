import { expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { summarizeSample, comparePerformance } from "../../../scripts/performance/metrics.mjs";
import { attributeTrace, beginTrace } from "../../../scripts/performance/trace.mjs";
import { extractMarkdownLinkTargets } from "../../../scripts/lib/markdown.mjs";
import { checkDocumentation } from "../../../scripts/checks/check-docs.mjs";
import { repository } from "../../support/tooling.mjs";

const sample = () => ({
  frames: Array.from({ length: 80 }, (_, i) => ({ start: i * 16, end: (i + 1) * 16, duration: 16 })),
  focused: true,
  visibility: "visible",
  segments: [{ name: "play", complete: true, start: 0, end: 1280, duration: 1280, frames: 80 }],
  longTasks: null,
  input: null,
});

it("rejects incomplete or unbounded performance evidence", () => {
  const base = sample();
  expect(() => summarizeSample({ ...base, frames: Array(12001).fill(base.frames[0]) })).toThrow(
    "frame samples",
  );
  expect(() => summarizeSample({ ...base, longTasks: undefined })).toThrow("observer");
  expect(() => summarizeSample({ ...base, input: undefined })).toThrow("observer");
  expect(() => summarizeSample({ ...base, spans: {} })).toThrow("span");
  expect(() => summarizeSample({ ...base, longTasks: [{ start: 1e308, duration: 1e308 }] })).toThrow(
    "observer",
  );
  for (const inputDelay of [-1, Infinity])
    expect(() => summarizeSample({ ...base, input: [{ start: 1, duration: 16, inputDelay }] })).toThrow(
      "observer",
    );
});

it("compares equivalent environment objects independent of key order", () => {
  const report = {
    format: 3,
    complete: true,
    environment: { viewport: { width: 1280, height: 800 }, trace: false },
    cases: [{ id: "battle", checkpointHash: "a", actionHash: "b", fixture: "v1", sample: sample() }],
  };
  const reordered = { ...report, environment: { trace: false, viewport: { height: 800, width: 1280 } } };
  expect(comparePerformance(report, reordered)[0].p95Delta).toBe(0);
  expect(() => comparePerformance(report, { ...reordered, environment: { trace: true } })).toThrow();
});

it("does not attribute malformed trace events", () => {
  const markers = [
    { name: "fauna-capture-start", pid: 1, tid: 1, ts: 1000 },
    { name: "fauna-capture-end", pid: 1, tid: 1, ts: 11000 },
  ];
  expect(attributeTrace({ traceEvents: {} }, { markerStart: 0, markerEnd: 10 }, []).available).toBe(false);
  const result = attributeTrace(
    { traceEvents: [...markers, null, { name: "Layout", pid: 1, tid: 1, ph: "X", ts: 1e308, dur: 1e308 }] },
    { markerStart: 0, markerEnd: 10 },
    [{ start: 0, end: 10, duration: 10 }],
  );
  expect(result.available).toBe(false);
});

it("preserves dropped or malformed traces as partial evidence only", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fauna-trace-"));
  try {
    for (const [index, data, loss] of [
      [0, '{"traceEvents":[]}', true],
      [1, "{}", false],
    ]) {
      const client = new EventEmitter();
      client.detach = async () => {};
      client.send = async (method) => {
        if (method === "Tracing.end")
          queueMicrotask(() =>
            client.emit("Tracing.tracingComplete", { stream: "stream", dataLossOccurred: loss }),
          );
        if (method === "IO.read") return { data, eof: true };
      };
      const file = path.join(directory, `${index}.json`);
      const stop = await beginTrace({ context: () => ({ newCDPSession: async () => client }) }, file);
      await expect(stop()).rejects.toThrow();
      await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(`${file}.partial`, "utf8")).toBe(data);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("checks real links while ignoring escaped and inline code examples", () => {
  const source = "\\[example](missing.md) and `[code](missing.md)` and [real](guide.md)";
  expect(extractMarkdownLinkTargets(source).map(({ target }) => target)).toEqual(["guide.md"]);
});

it("resolves encoded hash characters and URL queries in local documentation links", () => {
  const root = repository({
    "package.json": '{"scripts":{}}',
    "README.md": "[guide](Docs/Guide%23one.md?view=full#setup)\n",
    "Docs/Guide#one.md": "# Setup\n",
  });
  expect(checkDocumentation(root)).toEqual([]);
});
