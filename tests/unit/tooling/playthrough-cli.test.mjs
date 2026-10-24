import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { identity } from "../../../scripts/lib/tool-runtime.mjs";
import { parsePlaythroughArgs, runPlaythrough } from "../../../scripts/balance/run-playthrough.mjs";

afterEach(() => vi.useRealTimers());

it("rejects missing, duplicate and unknown playthrough options before starting a worker", async () => {
  expect(parsePlaythroughArgs(["--seed", "4", "--out", "reports/career"])).toEqual({
    "--seed": "4",
    "--out": "reports/career",
  });
  for (const args of [
    ["--out"],
    ["--save"],
    ["--replay", "--out", "reports/career"],
    ["--seed", "4", "--seed", "5"],
    ["--unknown", "value"],
  ]) {
    const spawnWorker = vi.fn();
    await expect(runPlaythrough(args, { spawnWorker })).rejects.toThrow("playthrough option");
    expect(spawnWorker).not.toHaveBeenCalled();
  }
});

it.each(["timeout", "SIGINT", "SIGTERM"])(
  "keeps %s as a failed playthrough even if the stopped worker exits zero",
  async (reason) => {
    vi.useFakeTimers();
    const child = new EventEmitter();
    child.kill = vi.fn();
    const settled = vi.fn();
    const counts = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
    const running = runPlaythrough([], { timeout: 100, spawnWorker: () => child });
    const checked = expect(running).rejects.toThrow(reason === "timeout" ? "watchdog" : "cancelled");
    running.then(settled, settled);
    if (reason === "timeout") await vi.advanceTimersByTimeAsync(100);
    else process.emit(reason);
    await Promise.resolve();
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    expect(settled).not.toHaveBeenCalled();
    child.emit("exit", 0);
    await checked;
    expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(counts);
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("cleans up playthrough supervision when the worker cannot start", async () => {
  vi.useFakeTimers();
  const child = new EventEmitter();
  const running = runPlaythrough([], { spawnWorker: () => child });
  const checked = expect(running).rejects.toThrow("cannot start");
  child.emit("error", new Error("cannot start"));
  await checked;
  expect(vi.getTimerCount()).toBe(0);
});

it("releases a successful playthrough's watchdog and signal listeners", async () => {
  vi.useFakeTimers();
  const child = new EventEmitter();
  child.kill = vi.fn();
  const counts = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
  const running = runPlaythrough([], { timeout: 100, spawnWorker: () => child });
  child.emit("exit", 0);
  await running;
  await vi.advanceTimersByTimeAsync(100);
  expect(child.kill).not.toHaveBeenCalled();
  expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(counts);
  expect(vi.getTimerCount()).toBe(0);
});

it("writes a durable journal and replays the CLI's recorded production career", async () => {
  const directory = path.join("reports", `cli-fixture-${randomUUID()}`);
  const replayDirectory = path.join(directory, "replay");
  try {
    const invoke = (args) =>
      execFileSync(process.execPath, ["scripts/balance/run-playthrough.mjs", ...args], {
        encoding: "utf8",
        timeout: 10_000,
        env: { ...process.env, FAUNA_PLAYTHROUGH_PROFILE: "1" },
      });
    // Policy changes can stall a particular career; this fixture owns successful CLI replay.
    invoke(["--seed", "15", "--starter", "captoad", "--runs", "1", "--out", directory]);
    const summary = JSON.parse(readFileSync(path.join(directory, "summary.json"), "utf8"));
    const bundle = JSON.parse(readFileSync(path.join(directory, "journey.json"), "utf8"));
    expect(summary.complete).toBe(true);
    expect(bundle.identity).toBe(await identity());
    expect(bundle.steps.every((step) => typeof step.decision === "string" && step.decision.length > 0)).toBe(
      true,
    );
    const journal = readFileSync(path.join(directory, summary.journal), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(journal.filter((record) => record.type === "attempt")).toHaveLength(bundle.steps.length);
    expect(journal.filter((record) => record.type === "completed")).toHaveLength(bundle.steps.length);
    expect(journal[0]).toMatchObject({ type: "initial", identity: bundle.identity, initial: bundle.initial });
    for (const [index, step] of bundle.steps.entries()) {
      expect(journal[index * 2 + 1]).toMatchObject({ type: "attempt", index, command: step.command });
      expect(journal[index * 2 + 2]).toEqual({ type: "completed", index, ...step });
    }
    invoke(["--replay", path.join(directory, "journey.json"), "--out", replayDirectory]);
    expect(JSON.parse(readFileSync(path.join(replayDirectory, "journey.json"), "utf8")).steps).toEqual(
      bundle.steps,
    );
    const replaySummary = JSON.parse(readFileSync(path.join(replayDirectory, "summary.json"), "utf8"));
    for (const { profile } of [summary, replaySummary]) {
      expect(profile.journalRecords).toBe(1 + 2 * bundle.steps.length);
      expect(Object.keys(profile.stages)).toEqual([
        "viteSetupMs",
        "identityMs",
        "moduleLoadMs",
        "fixtureSetupMs",
        "journeyMs",
      ]);
      expect(
        [profile.journalMs, ...Object.values(profile.stages)].every((ms) => Number.isFinite(ms) && ms >= 0),
      ).toBe(true);
    }
    mkdirSync("reports/ci", { recursive: true });
    writeFileSync(
      "reports/ci/playthrough-timings.json",
      JSON.stringify(
        {
          identity: bundle.identity,
          sha: process.env.GITHUB_SHA ?? null,
          generation: summary.profile,
          replay: replaySummary.profile,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 25_000);
