import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { rankBalanceFindings } from "../../../scripts/balance/findings.mjs";
import { compareBalance } from "../../../scripts/balance/paired-balance.mjs";
import { main } from "../../../scripts/balance/balance-compare.mjs";
import { ROOT } from "../../../scripts/lib/tool-runtime.mjs";
const row = (starter, seed, win = 0, turns = 20) => ({
  key: `${starter}-${seed}`,
  starter,
  actualStarter: starter,
  seed,
  complete: true,
  baseHash: "base",
  initialHash: "initial",
  evidence: `case-${seed}.json`,
  metrics: { win, turns, xp: 3, health: 4, currency: 20, encounter: 1, swaps: 1 },
});
const report = (cases) => ({
  format: 1,
  kind: "career",
  identity: "code",
  settings: {},
  complete: true,
  cases,
  failures: [],
});
it("ranks incomplete evidence above tuning findings and never counts unfinished cases as defeats", () => {
  const input = report(Array.from({ length: 5 }, (_, i) => row("mossguard", i, 0, 140)));
  input.complete = false;
  input.cases.push({ key: "emberback-0", complete: false });
  input.failures.push({ key: "emberback-0", reason: "watchdog", journal: "attempts.jsonl" });
  const result = rankBalanceFindings(input);
  expect(result.findings[0]).toMatchObject({ id: "incomplete", severity: "critical" });
  expect(result.findings.find((finding) => finding.id === "mossguard-length").rank).toBeLessThan(
    result.findings.find((finding) => finding.id === "mossguard-extreme").rank,
  );
  expect(result.findings.some((finding) => finding.id.startsWith("emberback"))).toBe(false);
});
it("keeps small, extreme and noisy paired samples tentative and ranks well-supported effects", () => {
  const baseline = report(Array.from({ length: 5 }, (_, i) => row("mossguard", i)));
  const treatment = structuredClone(baseline);
  treatment.cases.forEach((entry) => (entry.metrics.turns += 10));
  let findings = rankBalanceFindings(compareBalance(baseline, treatment)).findings;
  expect(findings.find((finding) => finding.id === "paired-turns")).toMatchObject({
    severity: "review",
    magnitude: 2,
  });
  baseline.cases = baseline.cases.slice(0, 1);
  treatment.cases = treatment.cases.slice(0, 1);
  findings = rankBalanceFindings(compareBalance(baseline, treatment)).findings;
  expect(findings[0].severity).toBe("watch");
  const samples = report(Array.from({ length: 5 }, (_, i) => row("mossguard", i)));
  const noisy = structuredClone(samples);
  [0, 0, 0, 0, 100].forEach((delta, i) => (noisy.cases[i].metrics.turns += delta));
  expect(rankBalanceFindings(compareBalance(samples, noisy)).findings[0].severity).toBe("watch");
  expect(rankBalanceFindings(report([row("mossguard", 0)])).findings[0].id).toBe("mossguard-samples");
});
it("does not invent findings from invalid or contradictory evidence", () => {
  const input = report([row("mossguard", 0)]);
  input.cases[0].metrics.win = NaN;
  expect(() => rankBalanceFindings(input)).toThrow("Invalid");
  expect(() => rankBalanceFindings(report([]))).toThrow("Contradictory");
});

it("does not attribute fallback drafts or unknown draft evidence to the preferred species", () => {
  const input = report(Array.from({ length: 5 }, (_, seed) => row("mossguard", seed, 1, 140)));
  input.cases.forEach((entry) => (entry.actualStarter = "emberback"));
  let findings = rankBalanceFindings(input).findings;
  expect(findings.map((finding) => finding.id)).toEqual(["starter-coverage"]);
  expect(findings[0].detail).toContain("5 of 5");
  delete input.cases[0].actualStarter;
  expect(rankBalanceFindings(input).findings.map((finding) => finding.id)).toEqual(["starter-coverage"]);
  input.cases.push(row("mossguard", 5, 1, 140));
  findings = rankBalanceFindings(input).findings;
  expect(findings.find((finding) => finding.id === "mossguard-samples").detail).toContain("1 completed");
  expect(findings.some((finding) => finding.id === "mossguard-length")).toBe(false);
});

it.each(["failures", "full"])("records the accepted draft with %s evidence", async (evidence) => {
  const directory = path.join(ROOT, "reports", `balance-draft-${randomUUID()}`);
  try {
    await main(
      ["run", "--starters", "mossguard", "--seeds", "1", "--evidence", evidence, "--out", directory],
      {
        sourceIdentity: async () => "code",
        pruneReports: async () => {},
        runCase: async (_input, output) => {
          await writeFile(
            output,
            JSON.stringify({
              complete: true,
              identity: "code",
              base: "base",
              initial: "initial",
              settings: {},
              metrics: row("mossguard", 1).metrics,
              replay: {
                steps: [
                  { command: { type: "draft", species: "mossguard" }, accepted: false },
                  { command: { type: "draft", species: "emberback" }, accepted: true },
                ],
              },
            }),
          );
          await writeFile(`${output}.journal.jsonl`, "completed attempt\n");
        },
      },
    );
    const result = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"));
    expect(result.cases[0]).toMatchObject({ starter: "mossguard", actualStarter: "emberback" });
    const detail = JSON.parse(await readFile(path.join(directory, "case-0.json"), "utf8"));
    expect(Boolean(detail.replay)).toBe(evidence === "full");
    if (evidence === "failures")
      await expect(readFile(path.join(directory, "case-0.json.journal.jsonl"))).rejects.toThrow();
    else
      expect(await readFile(path.join(directory, "case-0.json.journal.jsonl"), "utf8")).toContain(
        "completed",
      );
    expect(rankBalanceFindings(result).findings.map((finding) => finding.id)).toEqual(["starter-coverage"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects duplicate seeds and compares starters only across matching seed sets", () => {
  const left = Array.from({ length: 5 }, (_, seed) => row("mossguard", seed, 1));
  const right = Array.from({ length: 5 }, (_, seed) => row("emberback", seed + 5, 0));
  expect(
    rankBalanceFindings(report([...left, ...right])).findings.some((finding) =>
      finding.id.endsWith("spread"),
    ),
  ).toBe(false);
  right.forEach((entry, seed) => {
    entry.seed = seed;
    entry.key = `emberback-${seed}`;
  });
  expect(
    rankBalanceFindings(report([...left, ...right])).findings.find((finding) => finding.id.endsWith("spread"))
      .severity,
  ).toBe("watch");
  left[1].seed = left[0].seed;
  expect(() => rankBalanceFindings(report(left))).toThrow("duplicate career seeds");
});

it("findings boundary: rejects non-boolean report completion instead of treating it as completed evidence", () => {
  const input = report([row("mossguard", 0)]);
  for (const value of ["true", 1, null])
    expect(() => rankBalanceFindings({ ...input, complete: value })).toThrow("completion status");
});

it("findings boundary: rejects non-boolean case completion instead of including it in findings", () => {
  const input = report([row("mossguard", 0)]);
  for (const value of ["true", 1, null])
    expect(() => rankBalanceFindings({ ...input, cases: [{ ...input.cases[0], complete: value }] })).toThrow(
      "completion status",
    );
});

it("findings boundary: rejects impossible and fractional career metrics before producing findings", () => {
  const input = report([row("mossguard", 0)]);
  for (const patch of [{ health: -1 }, { turns: 2.5 }, { swaps: -1 }, { encounter: NaN }]) {
    const invalid = {
      ...input,
      cases: [{ ...input.cases[0], metrics: { ...input.cases[0].metrics, ...patch } }],
    };
    expect(() => rankBalanceFindings(invalid)).toThrow("Invalid metric");
  }
});

it("findings boundary: rejects impossible paired metrics before ranking a comparison", () => {
  const input = compareBalance(report([row("mossguard", 0)]), report([row("mossguard", 0)]));
  for (const patch of [{ health: -1 }, { turns: 2.5 }, { swaps: -1 }, { encounter: NaN }]) {
    const invalid = structuredClone(input);
    Object.assign(invalid.pairs[0].treatment, patch);
    expect(() => rankBalanceFindings(invalid)).toThrow("Invalid metric");
  }
});

it("findings boundary: counts each valid numeric career seed once, regardless of spelling", () => {
  const first = { ...row("mossguard", 1), seed: "01" };
  const second = { ...row("mossguard", 2), seed: 1 };
  expect(() => rankBalanceFindings(report([first, second]))).toThrow("duplicate career seeds");
  expect(() => rankBalanceFindings(report([{ ...first, seed: 4294967296 }]))).toThrow("career seeds");
});
