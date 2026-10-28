import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { git, put, repository, temporaryDirectory } from "../../support/tooling.mjs";
import { parseCheckArgs, runCheck } from "../../../scripts/checks/check.mjs";
import { describeTask, hostedStatus, taskStatus } from "../../../scripts/agent/task-status.mjs";
import { sections } from "../../../scripts/agent/agent-context.mjs";
import { lookupModifier } from "../../../scripts/agent/modifier-lookup.mjs";
import { uiGuide } from "../../../scripts/agent/ui-guide.mjs";
import {
  readTaskEvidence,
  recordTaskEvidence,
  recordVisualReview,
  sourceIdentity,
  visualReviewStatus,
} from "../../../scripts/lib/task-evidence.mjs";
import { verificationIdentity } from "../../../scripts/checks/input-identity.mjs";
import { taskBase } from "../../../scripts/lib/task-selection.mjs";

it("reports recorded tests as intent and never claims that the lightweight gate ran them", () => {
  const root = repository({
    "package.json": '{"dependencies":{},"devDependencies":{}}',
    "file.txt": "before\n",
  });
  git(root, "checkout", "-qb", "task/guidance");
  const suite = "tests/unit/example.test.ts";
  put(root, suite, "export {};\n");
  put(root, "file.txt", "after\n");
  const runner = vi.fn(() => ({ status: 0 }));
  const lines = [];
  expect(parseCheckArgs(["--record-test", suite]).tests).toEqual([suite]);
  expect(runCheck(["--record-test", suite], { root, runner, log: (line) => lines.push(line), env: {} })).toBe(
    0,
  );
  expect(lines.join("\n")).toContain("Planned but not run: selected suites and compilers");
  expect(runner.mock.calls.every(([, args]) => !args.some((arg) => arg.includes("vitest")))).toBe(true);
  const status = taskStatus(root);
  expect(status.recordedTests).toEqual([suite]);
  expect(describeTask(status)).toContain("intent only; not evidence of execution");
  expect(describeTask(status)).toContain("Working changes are not covered by this commit");
});

it("requires the exact hosted commit and a real final verify job", () => {
  const commit = "a".repeat(40);
  const runner = vi
    .fn()
    .mockReturnValueOnce({ status: 0, stdout: JSON.stringify([{ databaseId: 1, headSha: commit }]) })
    .mockReturnValueOnce({
      status: 0,
      stdout: JSON.stringify({
        headSha: commit,
        status: "completed",
        conclusion: "success",
        jobs: [],
        url: "https://example.invalid/run",
      }),
    });
  expect(hostedStatus("/repo", commit, runner)).toContain("final verify job: not found");
  const mismatch = vi
    .fn()
    .mockReturnValue({ status: 0, stdout: JSON.stringify([{ databaseId: 1, headSha: "b".repeat(40) }]) });
  expect(hostedStatus("/repo", commit, mismatch)).toContain("No hosted workflow found");
  expect(hostedStatus("/repo", commit, () => ({ status: 1 }))).toContain("unavailable");
});

it("reports a local result only for the same committed and working source", () => {
  const root = repository({
    "package.json": '{"dependencies":{},"devDependencies":{}}',
    "file.txt": "before\n",
  });
  const identity = sourceIdentity(root);
  recordTaskEvidence(root, identity, "gate", "passed");
  recordTaskEvidence(root, identity, "regression", "tests/unit/example.test.ts");
  expect(readTaskEvidence(root)).toEqual({ gate: "passed", regression: "tests/unit/example.test.ts" });
  expect(describeTask(taskStatus(root))).toContain("Local gate: passed for current source");
  put(root, "file.txt", "changed\n");
  expect(readTaskEvidence(root)).toEqual({});
  expect(describeTask(taskStatus(root))).toContain("Local gate: unknown");
  put(root, "file.txt", "before\n");
  put(root, "new.txt", "untracked\n");
  expect(readTaskEvidence(root)).toEqual({});
});

it("records only an explicitly inspected complete capture for the current source", () => {
  const root = repository({
    ".gitignore": "reports/\n",
    "package.json": '{"dependencies":{},"devDependencies":{}}',
  });
  const file = "reports/capture/evidence.json";
  const evidence = {
    complete: true,
    source: verificationIdentity(root, taskBase(root), [], {}, "capture"),
    frames: [{ file: "frame.png", errors: [], layoutFailures: [] }],
  };
  put(root, "reports/capture/frame.png", "frame");
  put(root, file, JSON.stringify(evidence));
  recordVisualReview(root, file, {});
  expect(visualReviewStatus(root, readTaskEvidence(root).visual)).toBe(file);
  put(root, "reports/capture/frame.png", "modified");
  expect(visualReviewStatus(root, readTaskEvidence(root).visual)).toBeNull();
  put(root, file, JSON.stringify({ ...evidence, complete: false }));
  expect(() => recordVisualReview(root, file, {})).toThrow("incomplete");
  put(root, file, JSON.stringify({ ...evidence, source: "different" }));
  expect(() => recordVisualReview(root, file, {})).toThrow("differs");
});

it("locates both implementation and query owners without guessing from names", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  const result = lookupModifier(root, "dodge.finding-rhythm");
  expect(result.bindings.map((entry) => entry.contract)).toEqual([
    "modifierImplementations",
    "modifierQueries",
  ]);
  expect(result.matches.some((file) => file.startsWith("src/game/content/talents/dodge.ts:"))).toBe(true);
  expect(result.matches.some((file) => file.startsWith("tests/"))).toBe(true);
  expect(result.owners.some((owner) => owner.location.startsWith("src/game/combat/state.ts:"))).toBe(true);
  expect(result.owners.some((owner) => owner.location.startsWith("src/game/combat/damage.ts:"))).toBe(true);
  expect(result.definitions.some((file) => file.startsWith("src/game/rules/talents.ts:"))).toBe(true);
  expect(result.tests.some((file) => file.startsWith("tests/unit/game/"))).toBe(true);
  const boon = lookupModifier(root, "pumpkin-tureen");
  expect(boon.owners.length).toBeGreaterThan(0);
  expect(() => lookupModifier(root, "not-an-id")).toThrow("No binding found");
});

it("guides a matching layout capture without claiming visual approval", () => {
  const guide = uiGuide("layout", "battle");
  if (process.platform === "darwin") expect(guide).toContain("heavy_lane.py");
  expect(guide).toContain("--label before");
  expect(guide).toContain("--label after");
  expect(guide).toContain("have not been performed");
  expect(() => uiGuide("layout", "missing")).toThrow("Choose a scenario");
});

describe("navigation guidance boundaries", () => {
  const scan = (source) => {
    const root = temporaryDirectory("fauna-context-headings-");
    put(root, "guide.md", source);
    return sections(root, "guide.md");
  };

  it("does not close a code fence on a delimiter with trailing content", () => {
    const rows = scan("# Guide\n```ts\n```still-code\n## Hidden\n```\n## Visible");
    expect(rows.map((row) => row.heading)).toEqual(["Guide", "Visible"]);
  });

  it("does not open a backtick fence with backticks inside its info string", () => {
    const rows = scan("# Guide\n```invalid`info\n## Visible");
    expect(rows.map((row) => row.heading)).toEqual(["Guide", "Visible"]);
  });

  it("recognizes up to three spaces of heading indentation without treating code as a heading", () => {
    const rows = scan(" # One\n  ## Two\n   ### Three\n    # Code");
    expect(rows.map((row) => [row.heading, row.start])).toEqual([
      ["One", 1],
      ["Two", 2],
      ["Three", 3],
    ]);
  });

  it("removes closing heading markers but preserves hashes attached to the title", () => {
    const rows = scan("# Guide ###\n## C#\n## Recovery owners ##");
    expect(rows.map((row) => row.heading)).toEqual(["Guide", "C#", "Recovery owners"]);
  });

  it("normalizes CRLF headings for exact topic matching", () => {
    const rows = scan("# Guide\r\n## Recovery owners\r\ntext\r\n");
    expect(rows[1]).toMatchObject({ heading: "Recovery owners", start: 2, end: 4 });
  });

  it("closes nested sections at the next same-level or parent heading", () => {
    const rows = scan("# One\nbody\n## Child\n### Deep\ntext\n## Sibling\ntext\n# Two\nlast");
    expect(rows.map(({ heading, start, end }) => ({ heading, start, end }))).toEqual([
      { heading: "One", start: 1, end: 7 },
      { heading: "Child", start: 3, end: 5 },
      { heading: "Deep", start: 4, end: 5 },
      { heading: "Sibling", start: 6, end: 7 },
      { heading: "Two", start: 8, end: 9 },
    ]);
  });

  it("matches dollar-sign handler names exactly and refreshes file caches on the next lookup", () => {
    const root = repository({
      "src/game/modifier-bindings.ts": `export const modifierImplementations = { talents: { sample: ["./rules/sample#$apply", "./rules/sample#apply$", "./rules/sample#apply"] } };
export const modifierQueries = { talents: { sample: ["./rules/sample#apply"] } };`,
      "src/game/rules/sample.ts": `export function applyExtra() {}
export function apply$Extra() {}
export function $apply() {}
export const apply$ = () => {};
export function apply() {}
const id = "sample";`,
      "tests/unit/game/sample.test.ts": `const double = "sample";
const single = 'sample';
const template = \`sample\`;`,
    });
    const first = lookupModifier(root, "sample");
    expect(first.owners.map((owner) => owner.location)).toEqual([
      "src/game/rules/sample.ts:3",
      "src/game/rules/sample.ts:4",
      "src/game/rules/sample.ts:5",
      "src/game/rules/sample.ts:5",
    ]);
    expect(first.tests).toEqual([
      "tests/unit/game/sample.test.ts:1",
      "tests/unit/game/sample.test.ts:2",
      "tests/unit/game/sample.test.ts:3",
    ]);
    put(
      root,
      "src/game/rules/sample.ts",
      "\nexport function $apply() {}\nexport const apply$ = () => {};\nexport function apply() {}\n",
    );
    expect(lookupModifier(root, "sample").owners.map((owner) => owner.location)).toEqual([
      "src/game/rules/sample.ts:2",
      "src/game/rules/sample.ts:3",
      "src/game/rules/sample.ts:4",
      "src/game/rules/sample.ts:4",
    ]);
  });
});
