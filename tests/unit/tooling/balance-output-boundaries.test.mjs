import { expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  main,
  parseBalanceOptions,
  parseBalanceSeeds,
  reserveBalanceDirectory,
} from "../../../scripts/balance/balance-compare.mjs";
import { reportDirectory } from "../../../scripts/lib/tool-runtime.mjs";

const metrics = { win: 1, turns: 4, health: 10, encounter: 1, swaps: 0, currency: 0, xp: 3 };
const report = {
  format: 1,
  kind: "career",
  complete: true,
  identity: "source",
  settings: {},
  failures: [],
  cases: [{ key: "emberback-0", complete: true, baseHash: "base", initialHash: "initial", metrics }],
};

it("preserves comparison evidence when the output already contains a report", async () => {
  const parent = await reportDirectory("reports/balance-boundary-tests");
  const directory = await mkdtemp(path.join(parent, "balance-output-test-"));
  try {
    const baseline = path.join(directory, "baseline.json");
    const treatment = path.join(directory, "treatment.json");
    await writeFile(baseline, JSON.stringify(report));
    await writeFile(treatment, JSON.stringify(report));
    const out = await reportDirectory(path.join(directory, "comparison"));
    await writeFile(path.join(out, "comparison.json"), "existing evidence");
    await expect(main(["compare", baseline, treatment, out])).rejects.toThrow("existing balance evidence");
    expect(await readFile(path.join(out, "comparison.json"), "utf8")).toBe("existing evidence");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("admits only one balance writer to an empty directory", async () => {
  const parent = await reportDirectory("reports/balance-boundary-tests");
  const directory = await mkdtemp(path.join(parent, "balance-writer-test-"));
  try {
    const release = await reserveBalanceDirectory(directory);
    await expect(reserveBalanceDirectory(directory)).rejects.toThrow("existing balance evidence");
    await release();
    const next = await reserveBalanceDirectory(directory);
    await next();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects empty or non-decimal seed entries instead of silently changing the suite", () => {
  expect(parseBalanceSeeds("0,42,4294967295")).toEqual([0, 42, 4294967295]);
  for (const value of ["0,", ",1", "0,,1", " 1", "0x10", "1e2"])
    expect(() => parseBalanceSeeds(value)).toThrow();
});

it("rejects a missing option value even when another option follows", () => {
  expect(() => parseBalanceOptions(["--out", "--evidence", "full"])).toThrow("Invalid option");
});

it("rejects extra or missing positional arguments before reading reports", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await expect(main(["compare", "a", "b", "out", "ignored"])).rejects.toThrow("Usage");
    await expect(main(["compare", "a"])).rejects.toThrow("Usage");
    await expect(main(["replay", "a", "ignored"])).rejects.toThrow("Usage");
    await expect(main(["replay"])).rejects.toThrow("Usage");
  } finally {
    log.mockRestore();
  }
});
