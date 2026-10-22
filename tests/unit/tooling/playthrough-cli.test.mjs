import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect, it } from "vitest";
import { identity } from "../../../scripts/lib/tool-runtime.mjs";
it("writes a durable journal and replays the CLI's recorded production career", async () => {
  const directory = path.join("reports", `cli-fixture-${randomUUID()}`);
  const replayDirectory = path.join(directory, "replay");
  try {
    const invoke = (args) =>
      execFileSync(process.execPath, ["scripts/balance/run-playthrough.mjs", ...args], {
        encoding: "utf8",
        timeout: 10_000,
      });
    invoke(["--seed", "4", "--starter", "captoad", "--runs", "1", "--out", directory]);
    const summary = JSON.parse(readFileSync(path.join(directory, "summary.json"), "utf8"));
    const bundle = JSON.parse(readFileSync(path.join(directory, "journey.json"), "utf8"));
    expect(summary.complete).toBe(true);
    expect(bundle.identity).toBe(await identity());
    const journal = readFileSync(path.join(directory, summary.journal), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(journal.filter((record) => record.type === "attempt")).toHaveLength(bundle.steps.length);
    expect(journal.filter((record) => record.type === "completed")).toHaveLength(bundle.steps.length);
    invoke(["--replay", path.join(directory, "journey.json"), "--out", replayDirectory]);
    expect(JSON.parse(readFileSync(path.join(replayDirectory, "journey.json"), "utf8")).steps).toEqual(
      bundle.steps,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 25_000);
