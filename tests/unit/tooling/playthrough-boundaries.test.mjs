import { expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parsePlaythroughArgs,
  reservePlaythroughDirectory,
  validatePlaythroughComparison,
} from "../../../scripts/balance/run-playthrough.mjs";

const config = { seed: 42, runs: 1, starter: "mossguard", policy: "heuristic" };
const bundle = () => ({
  format: 4,
  complete: true,
  identity: "before",
  policyVersion: 40,
  initial: "checkpoint",
  config,
});

it("preserves existing journey evidence and admits only one output writer", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-playthrough-boundary-"));
  try {
    const release = await reservePlaythroughDirectory(directory);
    await expect(reservePlaythroughDirectory(directory)).rejects.toThrow("existing evidence");
    await release();
    await writeFile(path.join(directory, "journey.json"), "retained evidence");
    await expect(reservePlaythroughDirectory(directory)).rejects.toThrow("existing evidence");
    expect(await readFile(path.join(directory, "journey.json"), "utf8")).toBe("retained evidence");
    expect(await readdir(directory)).toEqual(["journey.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects scenario overrides that replay would otherwise ignore", () => {
  for (const option of ["--seed", "--runs", "--starter", "--policy", "--save"])
    expect(() => parsePlaythroughArgs(["--replay", "record.json", option, "value"])).toThrow("Replay");
  expect(parsePlaythroughArgs(["--replay", "record.json", "--out", "reports/replay"])).toMatchObject({
    "--replay": "record.json",
  });
});

it("requires the same recorded policy version for a comparison", () => {
  const baseline = bundle();
  expect(() =>
    validatePlaythroughComparison(baseline, { ...bundle(), identity: "after" }, config),
  ).not.toThrow();
  expect(() => validatePlaythroughComparison(baseline, { ...bundle(), policyVersion: 41 }, config)).toThrow();
  expect(() =>
    validatePlaythroughComparison({ ...baseline, policyVersion: undefined }, bundle(), config),
  ).toThrow();
});

it("requires source identities before reporting whether code changed", () => {
  expect(() => validatePlaythroughComparison({ ...bundle(), identity: "" }, bundle(), config)).toThrow();
  expect(() =>
    validatePlaythroughComparison(bundle(), { ...bundle(), identity: undefined }, config),
  ).toThrow();
});

it("rejects incomplete or obsolete reports instead of treating them as complete", () => {
  expect(() => validatePlaythroughComparison(null, bundle(), config)).toThrow();
  for (const patch of [{ complete: false }, { complete: "true" }, { format: 3 }, { initial: "" }])
    expect(() => validatePlaythroughComparison({ ...bundle(), ...patch }, bundle(), config)).toThrow();
});
