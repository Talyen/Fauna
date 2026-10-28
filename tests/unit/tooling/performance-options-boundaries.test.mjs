import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parsePerformanceArgs } from "../../../scripts/performance/options.mjs";
import { ROOT, reportDirectory, reserveEvidenceFile } from "../../../scripts/lib/tool-runtime.mjs";
import { main } from "../../../scripts/performance/run-performance.mjs";
import { reserveInteractionReport } from "../../../scripts/lib/interaction-replay.mjs";

it("preserves existing capture evidence when reserving a report", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fauna-perf-capture-"));
  try {
    await writeFile(path.join(directory, "report.json"), "prior capture");
    await expect(reserveEvidenceFile(directory, "report.json", "replacement")).rejects.toThrow(
      "existing evidence",
    );
    expect(await readFile(path.join(directory, "report.json"), "utf8")).toBe("prior capture");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("preserves comparison evidence and excludes concurrent capture writers", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fauna-perf-comparison-"));
  try {
    const writes = await Promise.allSettled([
      reserveEvidenceFile(directory, "comparison.json", "comparison evidence"),
      reserveEvidenceFile(directory, "report.json", "capture evidence"),
    ]);
    expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(writes.filter((result) => result.status === "rejected")).toHaveLength(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  const shared = await mkdtemp(path.join(os.tmpdir(), "fauna-shared-evidence-"));
  try {
    const writes = await Promise.allSettled([
      reserveEvidenceFile(shared, "comparison.json", "comparison evidence"),
      reserveInteractionReport(shared, { complete: false }),
    ]);
    expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(writes.filter((result) => result.status === "rejected")).toHaveLength(1);
  } finally {
    await rm(shared, { recursive: true, force: true });
  }
  const parent = await reportDirectory("reports/performance-boundaries");
  const root = await mkdtemp(path.join(parent, "comparison-"));
  try {
    const sample = {
      frames: Array.from({ length: 80 }, (_, index) => ({
        start: index * 16,
        end: (index + 1) * 16,
        duration: 16,
      })),
      focused: true,
      visibility: "visible",
      longTasks: null,
      input: null,
      segments: [{ complete: true, start: 0, end: 1280, duration: 1280, frames: 80 }],
    };
    const report = {
      format: 3,
      complete: true,
      environment: { viewport: 1280 },
      cases: [{ id: "battle", checkpointHash: "a", actionHash: "b", fixture: "v1", sample }],
    };
    const before = path.join(root, "before.json");
    const after = path.join(root, "after.json");
    const out = await reportDirectory(path.join(root, "result"));
    await writeFile(before, JSON.stringify(report));
    await writeFile(after, JSON.stringify(report));
    await writeFile(path.join(out, "comparison.json"), "prior comparison");
    await expect(main(["compare", before, after, out])).rejects.toThrow("existing evidence");
    expect(await readFile(path.join(out, "comparison.json"), "utf8")).toBe("prior comparison");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("rejects duplicate capture flags", () => {
  expect(() => parsePerformanceArgs(["--trace", "--trace"])).toThrow("Duplicate");
  expect(() => parsePerformanceArgs(["--seed", "1", "--seed", "2"])).toThrow("Duplicate");
});

it("rejects missing option values and non-decimal seeds", () => {
  expect(() => parsePerformanceArgs(["--scenario", "--trace"])).toThrow("Missing value");
  for (const seed of ["0x10", "1e2", " 1"]) expect(() => parsePerformanceArgs(["--seed", seed])).toThrow();
  expect(parsePerformanceArgs(["--seed", "42", "--trace"]).seed).toBe(42);
});

it("rejects extra replay or comparison arguments and non-boolean replay completion", async () => {
  expect(() => parsePerformanceArgs(["replay", "report", "out", "ignored"])).toThrow("Invalid replay");
  expect(() => parsePerformanceArgs(["compare", "a", "b", "out", "ignored"])).toThrow("Invalid compare");
  const directory = await mkdtemp(path.join(os.tmpdir(), "fauna-perf-replay-"));
  try {
    const file = path.join(directory, "report.json");
    await writeFile(
      file,
      JSON.stringify({ format: 3, complete: "true", environment: { runtime: "chromium", cold: false } }),
    );
    await expect(main(["replay", file])).rejects.toThrow("incomplete or old");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects replay scenario paths and duplicate output names before creating evidence", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fauna-perf-replay-path-"));
  try {
    const file = path.join(directory, "report.json");
    const scenario = { id: "battle", initial: "save", fixture: "fixture", actions: [{ kind: "idle" }] };
    const report = {
      format: 3,
      complete: true,
      environment: { runtime: "chromium", cold: false },
      cases: [{ id: "battle", scenario }],
    };
    for (const cases of [
      [{ id: "../outside", scenario: { ...scenario, id: "../outside" } }],
      [
        { id: "battle", scenario },
        { id: "battle", scenario },
      ],
      [{ id: "other", scenario }],
    ]) {
      await writeFile(file, JSON.stringify({ ...report, cases }));
      await expect(main(["replay", file])).rejects.toThrow("Invalid performance replay scenarios");
    }
    expect(await readFile(file, "utf8")).toContain('"other"');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("includes the capture driver's shared dependencies in the hosted baseline overlay", async () => {
  const workflow = await readFile(path.join(ROOT, ".github/workflows/performance.yml"), "utf8");
  const overlay = workflow.match(/\$harness = @\(([^\n]+)\)/)?.[1] ?? "";
  expect(overlay).toContain("scripts/performance/options.mjs");
  expect(overlay).toContain("scripts/lib/tool-runtime.mjs");
});
