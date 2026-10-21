import { it, expect } from "vitest";
import { rankBalanceFindings } from "../../scripts/lib/balance-findings.mjs";
import { compareBalance } from "../../scripts/lib/paired-balance.mjs";
const row = (starter, seed, win = 0, turns = 20) => ({
  key: `${starter}-${seed}`,
  starter,
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
  const input = report(Array.from({ length: 5 }, (_, i) => row("mossback", i, 0, 140)));
  input.complete = false;
  input.cases.push({ key: "emberfox-0", complete: false });
  input.failures.push({ key: "emberfox-0", reason: "watchdog", journal: "attempts.jsonl" });
  const result = rankBalanceFindings(input);
  expect(result.findings[0]).toMatchObject({ id: "incomplete", severity: "critical" });
  expect(result.findings.find((finding) => finding.id === "mossback-length").rank).toBeLessThan(
    result.findings.find((finding) => finding.id === "mossback-extreme").rank,
  );
  expect(result.findings.some((finding) => finding.id.startsWith("emberfox"))).toBe(false);
});
it("keeps small, extreme and noisy paired samples tentative and ranks well-supported effects", () => {
  const baseline = report(Array.from({ length: 5 }, (_, i) => row("mossback", i)));
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
  const samples = report(Array.from({ length: 5 }, (_, i) => row("mossback", i)));
  const noisy = structuredClone(samples);
  [0, 0, 0, 0, 100].forEach((delta, i) => (noisy.cases[i].metrics.turns += delta));
  expect(rankBalanceFindings(compareBalance(samples, noisy)).findings[0].severity).toBe("watch");
  expect(rankBalanceFindings(report([row("mossback", 0)])).findings[0].id).toBe("mossback-samples");
});
it("does not invent findings from invalid or contradictory evidence", () => {
  const input = report([row("mossback", 0)]);
  input.cases[0].metrics.win = NaN;
  expect(() => rankBalanceFindings(input)).toThrow("Invalid");
  expect(() => rankBalanceFindings(report([]))).toThrow("Contradictory");
});

it("rejects duplicate seeds and compares starters only across matching seed sets", () => {
  const left = Array.from({ length: 5 }, (_, seed) => row("mossback", seed, 1));
  const right = Array.from({ length: 5 }, (_, seed) => row("emberfox", seed + 5, 0));
  expect(
    rankBalanceFindings(report([...left, ...right])).findings.some((finding) =>
      finding.id.endsWith("spread"),
    ),
  ).toBe(false);
  right.forEach((entry, seed) => {
    entry.seed = seed;
    entry.key = `emberfox-${seed}`;
  });
  expect(
    rankBalanceFindings(report([...left, ...right])).findings.find((finding) => finding.id.endsWith("spread"))
      .severity,
  ).toBe("watch");
  left[1].seed = left[0].seed;
  expect(() => rankBalanceFindings(report(left))).toThrow("duplicate career seeds");
});
