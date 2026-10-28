import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { runOwnedWorker } from "../../../scripts/lib/worker.mjs";

afterEach(() => vi.useRealTimers());
function worker(kill = () => true) {
  const child = new EventEmitter();
  child.kill = vi.fn(kill);
  return child;
}

it("cancels a worker when its factory aborts before listener registration", async () => {
  const controller = new AbortController();
  const child = worker();
  const settled = vi.fn();
  const running = runOwnedWorker("worker", [], 1000, {
    signal: controller.signal,
    spawnWorker: () => {
      controller.abort();
      return child;
    },
  });
  const checked = expect(running).rejects.toThrow("cancelled");
  running.then(settled, settled);
  expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  child.emit("exit", 0, null);
  await checked;
});

it("retains ownership after a running worker error until it exits", async () => {
  const child = worker();
  const settled = vi.fn();
  const running = runOwnedWorker("worker", [], 1000, { spawnWorker: () => child });
  const checked = expect(running).rejects.toThrow("worker transport failed");
  running.then(settled, settled);
  child.emit("error", new Error("worker transport failed"));
  expect(child.kill).toHaveBeenCalledOnce();
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  child.emit("exit", null, "SIGKILL");
  await checked;
});

it("finishes a failed spawn when close arrives without an exit event", async () => {
  const child = worker(() => false);
  const running = runOwnedWorker("worker", [], 1000, { spawnWorker: () => child });
  const checked = expect(running).rejects.toThrow("spawn failed");
  child.emit("error", new Error("spawn failed"));
  child.emit("close", -1, null);
  await checked;
});

it("keeps the first cancellation reason when the watchdog later expires", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const child = worker();
  const running = runOwnedWorker("worker", [], 100, { signal: controller.signal, spawnWorker: () => child });
  const checked = expect(running).rejects.toThrow("cancelled");
  controller.abort();
  await vi.advanceTimersByTimeAsync(100);
  expect(child.kill).toHaveBeenCalledOnce();
  child.emit("exit", 0, null);
  await checked;
});

it("waits for the worker even if termination throws", async () => {
  const controller = new AbortController();
  const child = worker(() => {
    throw new Error("signal failed");
  });
  const settled = vi.fn();
  const running = runOwnedWorker("worker", [], 1000, { signal: controller.signal, spawnWorker: () => child });
  const checked = expect(running).rejects.toThrow("cancelled");
  running.then(settled, settled);
  controller.abort();
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  child.emit("exit", 0, null);
  await checked;
});

it("owns termination before a synchronous worker error can reenter", async () => {
  const controller = new AbortController();
  const child = worker();
  child.kill.mockImplementation(() => {
    child.emit("error", new Error("signal failed"));
    return true;
  });
  const running = runOwnedWorker("worker", [], 1000, { signal: controller.signal, spawnWorker: () => child });
  const checked = expect(running).rejects.toThrow("cancelled");
  controller.abort();
  expect(child.kill).toHaveBeenCalledOnce();
  child.emit("exit", 0, null);
  await checked;
});

it("waits for close when an actual process fails to spawn", async () => {
  let closed = false;
  const missing = path.join(os.tmpdir(), `fauna-missing-worker-${randomUUID()}`);
  const running = runOwnedWorker("worker", [], 1000, {
    spawnWorker: () => {
      const child = spawn(missing, [], { stdio: "ignore" });
      child.once("close", () => {
        closed = true;
      });
      return child;
    },
  });
  await expect(running).rejects.toThrow();
  expect(closed).toBe(true);
});
