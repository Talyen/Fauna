import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { findingsMarkdown, rankBalanceFindings } from "../../../scripts/balance/findings.mjs";
import { compareBalance, pairedStats } from "../../../scripts/balance/paired-balance.mjs";
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
        runCase: async (_input, output) => {
          await writeFile(
            output,
            JSON.stringify({
              complete: true,
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

it("compares settings by content while retaining array order and value checks", () => {
  const baseline = {
    ...report([row("mossguard", 0)]),
    settings: { policy: { version: 1, mode: "auto" }, seeds: [1, 2] },
  };
  const treatment = { ...baseline, settings: { seeds: [1, 2], policy: { mode: "auto", version: 1 } } };
  expect(compareBalance(baseline, treatment).pairs).toHaveLength(1);
  expect(() =>
    compareBalance(baseline, { ...treatment, settings: { ...treatment.settings, seeds: [2, 1] } }),
  ).toThrow("incompatible");
  expect(() =>
    compareBalance(baseline, {
      ...treatment,
      settings: { ...treatment.settings, policy: { version: 2, mode: "auto" } },
    }),
  ).toThrow("incompatible");
});

it("rejects malformed and sparse paired samples instead of reporting NaN", () => {
  for (const samples of [null, {}, "12", [], Array(2), [NaN], [Infinity]])
    expect(() => pairedStats(samples)).toThrow("Invalid paired samples");
  expect(pairedStats([2, 4])).toMatchObject({ n: 2, mean: 3, standardError: 1, noisy: false });
});

it("refuses nonfinite derived statistics from otherwise finite samples", () => {
  for (const samples of [
    [Number.MAX_VALUE, Number.MAX_VALUE],
    [1e200, -1e200],
  ])
    expect(() => pairedStats(samples)).toThrow("finite numeric range");
});

it("requires usable case identities before ranking imported evidence", () => {
  const valid = report([row("mossguard", 0)]);
  const comparison = compareBalance(valid, valid);
  for (const key of [undefined, null, 1, "", "  "]) {
    expect(() => rankBalanceFindings({ ...valid, cases: [{ ...valid.cases[0], key }] })).toThrow(
      "Invalid balance cases",
    );
    expect(() => rankBalanceFindings({ ...comparison, pairs: [{ ...comparison.pairs[0], key }] })).toThrow(
      "case identity",
    );
  }
  expect(() => rankBalanceFindings({ ...comparison, pairs: [null] })).toThrow("paired evidence");
  expect(() => rankBalanceFindings(null)).toThrow("Unsupported balance report");
  expect(() => compareBalance(null, valid)).toThrow("incompatible balance reports");
});

it("does not treat matching blank starter fields as a confirmed draft", () => {
  for (const starter of ["", "  "]) {
    const input = report([{ ...row("mossguard", 0), starter, actualStarter: starter }]);
    expect(rankBalanceFindings(input).findings.map((finding) => finding.id)).toEqual(["starter-coverage"]);
  }
});

it("rejects malformed failure entries before formatting incomplete findings", () => {
  const input = { ...report([]), complete: false };
  for (const failure of [null, "watchdog", []])
    expect(() => rankBalanceFindings({ ...input, failures: [failure] })).toThrow("Invalid balance cases");
  const result = rankBalanceFindings({ ...input, failures: [{ key: "case-0", reason: "watchdog" }] });
  expect(findingsMarkdown(result)).toContain("case-0: watchdog");
});

it("encodes literal evidence filenames without turning hashes or questions into URL suffixes", () => {
  const input = report([{ ...row("mossguard", 0), evidence: "reports/run #1/case?100%.json" }]);
  const markdown = findingsMarkdown(rankBalanceFindings(input));
  expect(markdown).toContain("(<reports/run%20%231/case%3F100%25.json>)");
});

it("retains complete evidence for each metric finding without changing metric rankings", () => {
  const baseline = report(Array.from({ length: 5 }, (_, seed) => row("mossguard", seed)));
  const treatment = structuredClone(baseline);
  for (const entry of treatment.cases) {
    entry.metrics.turns += 10;
    entry.metrics.currency += 40;
    entry.evidence = `treatment-${entry.seed}.json`;
  }
  const result = rankBalanceFindings(compareBalance(baseline, treatment));
  expect(result.findings.map((finding) => finding.id)).toEqual(["paired-currency", "paired-turns"]);
  for (const finding of result.findings)
    expect(finding.evidence).toEqual(
      baseline.cases.map((entry, index) => ({
        key: entry.key,
        files: [entry.evidence, treatment.cases[index].evidence],
      })),
    );
});

it("matches seed sets independently of row order and leaves imported evidence untouched", () => {
  const left = Array.from({ length: 5 }, (_, seed) => row("mossguard", seed, 1));
  const right = Array.from({ length: 5 }, (_, seed) => row("emberback", seed, 0)).reverse();
  const input = report([...left, ...right]);
  const original = structuredClone(input);
  expect(rankBalanceFindings(input).findings.filter((finding) => finding.id.endsWith("spread"))).toHaveLength(
    1,
  );
  expect(input).toEqual(original);
});
