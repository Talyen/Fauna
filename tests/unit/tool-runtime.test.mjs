import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, symlinkSync, existsSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, reportDirectory } from "../../scripts/lib/tool-runtime.mjs";
import { main, runWorker } from "../../scripts/balance-compare.mjs";

const roots = [];
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("creates report directories but rejects traversal and symlinks before creating external children", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fauna-report-root-"));
  const outside = mkdtempSync(path.join(os.tmpdir(), "fauna-report-outside-"));
  roots.push(root, outside);
  const create = (input) => reportDirectory(input, "reports/default", { root });
  expect(await create()).toBe(path.join(root, "reports/default"));
  await expect(create("reports/../../outside")).rejects.toThrow("remain under reports");
  for (const name of ["reports/linked", "reports-link"]) {
    symlinkSync(outside, path.join(root, name), process.platform === "win32" ? "junction" : "dir");
  }
  await expect(create("reports/linked/new/child")).rejects.toThrow("symlink");
  expect(existsSync(path.join(outside, "new"))).toBe(false);
  rmSync(path.join(root, "reports"), { recursive: true });
  symlinkSync(outside, path.join(root, "reports"), process.platform === "win32" ? "junction" : "dir");
  await expect(create("reports/new/child")).rejects.toThrow("symlink");
  expect(existsSync(path.join(outside, "new"))).toBe(false);
});

it.each(["cancel", "timeout"])(
  "waits for an owned worker to exit after %s and retains failure even on exit zero",
  async (reason) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const child = new EventEmitter();
    child.kill = vi.fn();
    const spawnWorker = vi.fn(() => child);
    const settled = vi.fn();
    const running = runWorker("input", "output", 100, { signal: controller.signal, spawnWorker });
    const checked = expect(running).rejects.toThrow(reason === "cancel" ? "cancelled" : "watchdog");
    running.then(settled, settled);
    if (reason === "cancel") controller.abort();
    else await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    expect(settled).not.toHaveBeenCalled();
    child.emit("exit", 0);
    await checked;
    if (reason === "cancel") {
      expect(() => runWorker("input", "output", 100, { signal: controller.signal, spawnWorker })).toThrow();
      expect(spawnWorker).toHaveBeenCalledTimes(1);
    }
  },
);

it.each(["SIGINT", "SIGTERM"])(
  "stops the balance suite on %s and preserves incomplete evidence",
  async (signal) => {
    const parent = path.join(ROOT, "reports");
    mkdirSync(parent, { recursive: true });
    const out = mkdtempSync(path.join(parent, "cancel-regression-"));
    roots.push(out);
    const exitCode = process.exitCode;
    const listeners = process.listenerCount(signal);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const runCase = vi.fn(async (_input, _output, _timeout, { signal: abort }) => {
      process.emit(signal);
      abort.throwIfAborted();
    });
    try {
      await main(["run", "--starters", "mossguard", "--seeds", "0,1", "--out", out], { runCase });
      expect(runCase).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBe(1);
      const report = JSON.parse(readFileSync(path.join(out, "report.json"), "utf8"));
      expect(report.complete).toBe(false);
      expect(report.failures).toHaveLength(1);
      expect(existsSync(path.join(out, "case-1-config.json"))).toBe(false);
      expect(process.listenerCount(signal)).toBe(listeners);
    } finally {
      process.exitCode = exitCode;
    }
  },
);
