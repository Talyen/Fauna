import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { identity } from "../../../scripts/lib/tool-runtime.mjs";
import { describe, expect, it } from "vitest";
import {
  validateBrowserCoverage,
  validateJobs,
  validateUnit,
  validateInteraction,
} from "../../../scripts/ci/ci.mjs";

const test = (id, overrides = {}) => ({
  suites: [
    {
      specs: [
        {
          id,
          title: id,
          tests: [
            {
              projectName: "",
              status: "expected",
              expectedStatus: "passed",
              results: [{ status: "passed", retry: 0 }],
              ...overrides,
            },
          ],
        },
      ],
    },
  ],
  errors: [],
});
const combine = (...reports) => ({ suites: reports.flatMap((report) => report.suites), errors: [] });
describe("CI coverage gate", () => {
  it("accounts for each discovered case exactly once across shards", () => {
    const a = test("a"),
      b = test("b");
    expect(validateBrowserCoverage(combine(a, b), [a, b])).toBe(2);
    expect(() => validateBrowserCoverage(combine(a, b), [a])).toThrow("Incomplete");
    expect(() => validateBrowserCoverage(combine(a, b), [a, a])).toThrow("duplicate");
    expect(() => validateBrowserCoverage(a, [b])).toThrow("Unexpected");
  });
  it.each(["skipped", "unexpected", "flaky"])(
    "rejects %s outcomes rather than accepting a partial report",
    (status) => {
      expect(() => validateBrowserCoverage(test("a"), [test("a", { status })])).toThrow();
    },
  );
  it("rejects interrupted cases, retries, expected failures and runner errors", () => {
    for (const override of [
      { results: [] },
      { results: [{ status: "interrupted", retry: 0 }] },
      { results: [{ status: "passed", retry: 1 }] },
      { expectedStatus: "failed" },
    ])
      expect(() => validateBrowserCoverage(test("a"), [test("a", override)])).toThrow();
    expect(() =>
      validateBrowserCoverage(test("a"), [{ ...test("a"), errors: [{ message: "crash" }] }]),
    ).toThrow();
  });
  it("permits only the documented development-preview exclusion with its reason", () => {
    const report = test("development skip wins once through normal rewards", {
      status: "skipped",
      expectedStatus: "skipped",
      results: [{ status: "skipped" }],
      annotations: [{ type: "skip", description: "Requires an explicitly owned development preview." }],
    });
    expect(validateBrowserCoverage(report, [report])).toBe(1);
    delete report.suites[0].specs[0].tests[0].annotations;
    expect(() => validateBrowserCoverage(report, [report])).toThrow();
  });
  it("requires every upstream job even when reports are green", () => {
    const jobs = Object.fromEntries(
      ["prepare", "static", "unit", "build", "browser", "interactions", "windows"].map((name) => [
        name,
        { result: "success", outputs: { attempt: "1" } },
      ]),
    );
    expect(() => validateJobs(jobs, "1")).not.toThrow();
    expect(() => validateJobs(jobs, "2")).toThrow("another workflow attempt");
    for (const name of Object.keys(jobs))
      for (const result of ["failure", "cancelled", "skipped", undefined])
        expect(() => validateJobs({ ...jobs, [name]: { result } }, "1")).toThrow(name);
  });
  it("rejects incomplete unit suites and interaction traces", () => {
    const units = {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numPendingTests: 0,
      numPendingTestSuites: 0,
      numTotalTests: 1,
      numPassedTests: 1,
      testResults: [{ status: "passed", assertionResults: [{ status: "passed" }] }],
    };
    expect(() => validateUnit(units)).not.toThrow();
    expect(() => validateUnit({ ...units, numPassedTests: 0 })).toThrow();
    expect(() => validateUnit({ ...units, numPendingTests: 1 })).toThrow();
    for (const change of [
      { numTotalTests: undefined, numPassedTests: undefined },
      { testResults: [{}] },
      { testResults: [{ status: "passed", assertionResults: [] }] },
      { testResults: [{ status: "failed", assertionResults: [{ status: "passed" }] }] },
      { testResults: [{ status: "passed", assertionResults: [{ status: "skipped" }] }] },
    ])
      expect(() => validateUnit({ ...units, ...change })).toThrow();
    const trace = {
      format: 1,
      family: "mixed",
      initial: "checkpoint",
      complete: true,
      failure: null,
      identity: "current",
      seed: 42,
      actions: Array(12).fill({ kind: "reload", checkpointHash: "a".repeat(64) }),
    };
    expect(() => validateInteraction(trace, "current")).not.toThrow();
    expect(() => validateInteraction({ ...trace, complete: false }, "current")).toThrow();
    expect(() => validateInteraction(trace, "stale")).toThrow();
    for (const change of [
      { format: 0 },
      { family: "navigation" },
      { actions: Array(12).fill({}) },
      { actions: Array(12).fill({ kind: "battle", checkpointHash: "a".repeat(64) }) },
      { actions: Array(12).fill({ kind: "reload" }) },
    ])
      expect(() => validateInteraction({ ...trace, ...change }, "current")).toThrow();
  });
});

describe("workflow timing measurements", () => {
  it("separates dependency start delay from execution and records failed steps", async () => {
    const { timingReport } = await import("../../../scripts/ci/ci-timings.mjs");
    const result = timingReport(
      {
        id: 1,
        run_attempt: 2,
        head_sha: "sha",
        conclusion: "failure",
        created_at: "2026-10-21T00:00:00Z",
        run_started_at: "2026-10-21T00:00:05Z",
        updated_at: "2026-10-21T00:02:00Z",
      },
      [
        {
          name: "browser",
          conclusion: "failure",
          started_at: "2026-10-21T00:00:30Z",
          completed_at: "2026-10-21T00:02:00Z",
          steps: [
            {
              name: "tests",
              conclusion: "failure",
              started_at: "2026-10-21T00:01:00Z",
              completed_at: "2026-10-21T00:02:00Z",
            },
          ],
        },
      ],
    );
    expect(result.initialQueueSeconds).toBe(25);
    expect(result.activeElapsedSeconds).toBe(90);
    expect(result.runnerSeconds).toBe(90);
    expect(result.jobs[0].startDelaySeconds).toBe(25);
    expect(result.jobs[0].steps[0]).toEqual({ name: "tests", conclusion: "failure", seconds: 60 });
  });
});

it("fails the executable final gate for upstream failures, missing reports and interrupted shards", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fauna-ci-gate-"));
  const script = path.resolve(import.meta.dirname, "../../../scripts/ci/ci.mjs");
  const ids = { sha: "commit", run: "123", attempt: "1" };
  const jobs = Object.fromEntries(
    ["prepare", "static", "unit", "build", "browser", "interactions", "windows"].map((name) => [
      name,
      { result: "success", outputs: { attempt: "1" } },
    ]),
  );
  const put = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), JSON.stringify(value));
  };
  const run = (needs = jobs) =>
    spawnSync(process.execPath, [script, "gate"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_SHA: ids.sha,
        GITHUB_RUN_ID: ids.run,
        GITHUB_RUN_ATTEMPT: ids.attempt,
        GITHUB_STEP_SUMMARY: path.join(root, "summary.md"),
        CI_SHARDS: "1",
        CI_NEEDS: JSON.stringify(needs),
      },
    });
  try {
    put("reports/ci/build.json", ids);
    put("reports/ci/discovery.json", test("a"));
    put("reports/playwright.json", test("a"));
    put("reports/shards/browser-shard-1/reports/ci/shard.json", { ...ids, shard: 1, total: 1 });
    put("reports/shards/browser-shard-1/reports/playwright.json", test("a"));
    put("reports/vitest.json", {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      numPendingTests: 0,
      numPendingTestSuites: 0,
      numTotalTests: 1,
      numPassedTests: 1,
      testResults: [{ status: "passed", assertionResults: [{ status: "passed" }] }],
    });
    put("reports/interactions/ci/report.json", {
      format: 1,
      family: "mixed",
      initial: "checkpoint",
      complete: true,
      failure: null,
      identity: await identity(),
      seed: 42,
      actions: Array(12).fill({ kind: "reload", checkpointHash: "a".repeat(64) }),
    });
    const green = run();
    expect(green.stderr).toBe("");
    expect(green.status).toBe(0);
    expect(readFileSync(path.join(root, "summary.md"), "utf8")).toContain("All required jobs succeeded");
    for (const job of ["static", "browser", "windows"])
      expect(run({ ...jobs, [job]: { result: "failure" } }).status).not.toBe(0);
    for (const file of [
      "reports/vitest.json",
      "reports/ci/discovery.json",
      "reports/shards/browser-shard-1/reports/ci/shard.json",
      "reports/playwright.json",
    ]) {
      const original = readFileSync(path.join(root, file), "utf8");
      rmSync(path.join(root, file));
      expect(run().status).not.toBe(0);
      writeFileSync(path.join(root, file), original);
    }
    put(
      "reports/shards/browser-shard-1/reports/playwright.json",
      test("a", { results: [{ status: "interrupted", retry: 0 }] }),
    );
    expect(run().status).not.toBe(0);
    put("reports/shards/browser-shard-1/reports/playwright.json", test("a"));
    put("reports/shards/browser-shard-1/reports/ci/shard.json", {
      ...ids,
      attempt: "old",
      shard: 1,
      total: 1,
    });
    expect(run().status).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("ships portable merged JSON attachments and rejects missing resources", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fauna-ci-evidence-"));
  const script = path.resolve(import.meta.dirname, "../../../scripts/ci/ci.mjs");
  try {
    mkdirSync(path.join(root, "reports"));
    mkdirSync(path.join(root, "all-blob-reports/resources"), { recursive: true });
    const image = path.join(root, "all-blob-reports/resources/frame.png");
    writeFileSync(image, "image bytes");
    const report = test("screen", {
      results: [
        {
          status: "passed",
          retry: 0,
          attachments: [{ path: image, name: "screen", contentType: "image/png" }],
        },
      ],
    });
    writeFileSync(path.join(root, "reports/playwright.json"), JSON.stringify(report));
    const run = () => spawnSync(process.execPath, [script, "portable"], { cwd: root, encoding: "utf8" });
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const portable = JSON.parse(readFileSync(path.join(root, "reports/playwright.json"), "utf8"));
    expect(portable.suites[0].specs[0].tests[0].results[0].attachments[0].path).toBe(
      "browser-resources/frame.png",
    );
    expect(readFileSync(path.join(root, "reports/browser-resources/frame.png"), "utf8")).toBe("image bytes");
    writeFileSync(path.join(root, "reports/playwright.json"), JSON.stringify(report));
    rmSync(image);
    expect(run().status).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("rejects modified or stale downloaded builds before starting browser consumers", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fauna-ci-build-"));
  const script = path.resolve(import.meta.dirname, "../../../scripts/ci/ci.mjs");
  const env = { ...process.env, GITHUB_SHA: "commit", GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" };
  const run = (command, overrides = {}) =>
    spawnSync(process.execPath, [script, command], {
      cwd: root,
      encoding: "utf8",
      env: { ...env, ...overrides },
    });
  try {
    mkdirSync(path.join(root, "dist/assets"), { recursive: true });
    const entry = path.join(root, "dist/assets/index.js");
    writeFileSync(entry, "original build");
    expect(run("build").status).toBe(0);
    expect(run("verify-build").status).toBe(0);
    writeFileSync(entry, "modified build");
    expect(run("verify-build").status).not.toBe(0);
    writeFileSync(entry, "original build");
    writeFileSync(path.join(root, "dist/extra.js"), "unexpected file");
    expect(run("verify-build").status).not.toBe(0);
    rmSync(path.join(root, "dist/extra.js"));
    expect(run("verify-build", { GITHUB_RUN_ATTEMPT: "2" }).status).not.toBe(0);
    expect(run("verify-build", { GITHUB_SHA: "another commit" }).status).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
