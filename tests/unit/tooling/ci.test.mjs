import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { identity } from "../../../scripts/lib/tool-runtime.mjs";
import { summarizeReport } from "../../../scripts/ci/ci-summarize.mjs";
import { LINEUP_SHARDS, lineupShard } from "../../../scripts/ci/unit-shards.mjs";
import { afterEach, describe, expect, it } from "vitest";
import {
  validateBrowserCoverage,
  validateJobs,
  validateUnit,
  validateUnitCoverage,
  mergeUnitReports,
  validateInteraction,
  planBrowserShards,
  browserDurations,
  buildFingerprint,
  validateBuildEvidence,
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

function unitReport(file, titles) {
  return {
    success: true,
    startTime: 1000,
    numFailedTests: 0,
    numFailedTestSuites: 0,
    numPendingTests: 0,
    numPendingTestSuites: 0,
    numTotalTests: titles.length,
    numPassedTests: titles.length,
    testResults: [
      {
        name: `/runner/${file}`,
        status: "passed",
        startTime: 1000,
        endTime: 2000,
        assertionResults: titles.map((title) => ({
          status: "passed",
          title,
          ancestorTitles: ["journey"],
          duration: 500,
        })),
      },
    ],
  };
}

it("partitions lineup scenarios without omissions or duplication and rejects invalid selectors", () => {
  const scenarios = Array.from({ length: 11 }, (_, seed) => ({ seed }));
  const groups = Array.from({ length: LINEUP_SHARDS }, (_, index) =>
    lineupShard(scenarios, String(index + 1)),
  );
  expect(new Set(groups.flat())).toEqual(new Set(scenarios));
  expect(groups.flat()).toHaveLength(scenarios.length);
  expect(groups.map((group) => group.length)).toEqual(
    Array.from(
      { length: LINEUP_SHARDS },
      (_, index) =>
        Math.floor(scenarios.length / LINEUP_SHARDS) + Number(index < scenarios.length % LINEUP_SHARDS),
    ),
  );
  expect(lineupShard(scenarios, undefined)).toBe(scenarios);
  for (const selector of ["", "0", String(LINEUP_SHARDS + 1), "01", "1.5", "wrong"])
    expect(() => lineupShard(scenarios, selector)).toThrow("Invalid lineup shard");
});

it("requires the exact discovered unit cases across reports, including parameterized titles", () => {
  const file = "tests/unit/contract.test.ts";
  const lineupFile = "tests/exhaustive/roster-combinations.test.ts";
  const contract = unitReport(file, ["resume", "resume"]);
  const lineup = unitReport(lineupFile, ["team one"]);
  const discovery = [
    { file, name: "journey > resume" },
    { file, name: "journey > resume" },
    { file: lineupFile, name: "journey > team one" },
  ];
  expect(validateUnitCoverage(discovery, [contract, lineup])).toBe(3);
  expect(mergeUnitReports(discovery, [contract, lineup]).numPassedTests).toBe(3);
  expect(() => validateUnitCoverage(discovery, [contract])).toThrow("Incomplete unit coverage");
  expect(() => validateUnitCoverage(discovery, [contract, lineup, lineup])).toThrow("duplicate");
  expect(() => validateUnitCoverage(discovery, [contract, unitReport(lineupFile, ["team two"])])).toThrow(
    "Unexpected",
  );
  expect(() => validateUnitCoverage(discovery, [contract, unitReport(file, ["team one"])])).toThrow(
    "Unexpected",
  );
  expect(() => validateUnitCoverage([], [contract])).toThrow("Empty unit discovery");
  expect(() => validateUnitCoverage(discovery, [{ ...contract, numPendingTests: 1 }, lineup])).toThrow(
    "Incomplete or failed",
  );
});

it("shows bounded, sorted unit durations and sanitizes diagnostic names", () => {
  const report = unitReport(
    "tests/unit/<unsafe>.test.ts",
    Array.from({ length: 12 }, (_, i) => `case ${i}`),
  );
  report.testResults[0].assertionResults.forEach((test, i) => {
    test.duration = i * 1000;
  });
  const summary = summarizeReport("vitest", report);
  expect(summary).toContain("Slowest test files");
  expect(summary).toContain("1.00s — tests/unit/&#60;unsafe&#62;.test.ts");
  expect(summary).toContain("Slowest tests");
  expect(summary.indexOf("11.00s")).toBeLessThan(summary.indexOf("10.00s"));
  expect(summary).not.toContain("<unsafe>");
  expect(summary).not.toContain("— case 0\n");
  report.testResults[0].assertionResults[0].duration = NaN;
  expect(summarizeReport("vitest", report)).not.toContain("NaNs");
});
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
      ["prepare", "static", "unit", "lineups", "build", "browser", "interactions", "windows"].map((name) => [
        name,
        { result: "success", outputs: { attempt: "1" } },
      ]),
    );
    expect(() => validateJobs(jobs, "1")).not.toThrow();
    expect(() => validateJobs(jobs, "2")).not.toThrow();
    for (const attempt of [undefined, "0", "future", "3"])
      expect(() => validateJobs({ ...jobs, unit: { result: "success", outputs: { attempt } } }, "2")).toThrow(
        "unit",
      );
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

const gateRoots = [];
afterEach(() => {
  for (const root of gateRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("defaults browser consumers to the version-matched container while retaining install comparison", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fauna-ci-prepare-"));
  gateRoots.push(root);
  const event = path.join(root, "event.json");
  const output = path.join(root, "output.txt");
  writeFileSync(
    path.join(root, "package-lock.json"),
    JSON.stringify({ packages: { "node_modules/@playwright/test": { version: "1.64.1" } } }),
  );
  const run = (inputs) => {
    writeFileSync(event, JSON.stringify({ inputs }));
    writeFileSync(output, "");
    return spawnSync(
      process.execPath,
      [path.resolve(import.meta.dirname, "../../../scripts/ci/ci.mjs"), "prepare"],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_EVENT_PATH: event,
          GITHUB_OUTPUT: output,
          GITHUB_EVENT_NAME: "workflow_dispatch",
          GITHUB_RUN_ATTEMPT: "1",
        },
      },
    );
  };
  expect(run({}).status).toBe(0);
  expect(readFileSync(output, "utf8")).toContain(
    "browser_image=mcr.microsoft.com/playwright:v1.64.1-noble\n",
  );
  expect(readFileSync(output, "utf8")).toContain("workers=1\n");
  expect(run({ shards: "4", browser_workers: "2" }).status).toBe(0);
  expect(readFileSync(output, "utf8")).toContain("total=4\nworkers=2\n");
  expect(run({ shards: "8", browser_workers: "2" }).status).not.toBe(0);
  for (const browser_workers of ["0", "3", "1.5", "wrong"])
    expect(run({ browser_workers }).status).not.toBe(0);
  expect(run({ browser_runtime: "install" }).status).toBe(0);
  expect(readFileSync(output, "utf8")).toContain("browser_image=\n");
  expect(run({ browser_runtime: "unknown" }).status).not.toBe(0);
});

async function gateFixture(workers = 1) {
  const root = mkdtempSync(path.join(tmpdir(), "fauna-ci-gate-"));
  gateRoots.push(root);
  const script = path.resolve(import.meta.dirname, "../../../scripts/ci/ci.mjs");
  const ids = { sha: "commit", run: "123", attempt: "1" };
  const manifest = { ...ids, files: { "dist/index.js": "a".repeat(64) } };
  const build = buildFingerprint(manifest);
  const jobs = Object.fromEntries(
    ["prepare", "static", "unit", "lineups", "build", "browser", "interactions", "windows"].map((name) => [
      name,
      { result: "success", outputs: { attempt: "1" } },
    ]),
  );
  const put = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), JSON.stringify(value));
  };
  const run = (needs = jobs, attempt = ids.attempt) =>
    spawnSync(process.execPath, [script, "gate"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_SHA: ids.sha,
        GITHUB_RUN_ID: ids.run,
        GITHUB_RUN_ATTEMPT: attempt,
        GITHUB_STEP_SUMMARY: path.join(root, "summary.md"),
        CI_SHARDS: "1",
        CI_BROWSER_WORKERS: String(workers),
        CI_NEEDS: JSON.stringify(needs),
      },
    });
  put("reports/ci/build.json", manifest);
  put("reports/ci/unit.json", ids);
  put("reports/interactions/ci/evidence.json", { ...ids, build });
  put("reports/ci/discovery.json", test("a"));
  put("reports/playwright.json", test("a"));
  put("reports/shards/browser-shard-1/reports/ci/shard.json", {
    ...ids,
    build,
    shard: 1,
    workers,
    total: 1,
  });
  put("reports/shards/browser-shard-1/reports/playwright.json", test("a"));
  put("reports/vitest.json", {
    success: true,
    numFailedTests: 0,
    numFailedTestSuites: 0,
    numPendingTests: 0,
    numPendingTestSuites: 0,
    numTotalTests: 1,
    numPassedTests: 1,
    startTime: 1000,
    testResults: [
      {
        name: "/runner/tests/unit/example.test.ts",
        startTime: 1000,
        endTime: 2000,
        status: "passed",
        assertionResults: [{ status: "passed", title: "contract" }],
      },
    ],
  });
  const unitDiscovery = [{ file: "/runner/tests/unit/example.test.ts", name: "contract" }];
  for (let shard = 1; shard <= LINEUP_SHARDS; shard++) {
    const file = "/runner/tests/exhaustive/roster-combinations.test.ts";
    const title = `lineup ${shard}`;
    const report = JSON.parse(readFileSync(path.join(root, "reports/vitest.json"), "utf8"));
    report.testResults[0].name = file;
    report.testResults[0].assertionResults[0].title = title;
    put(`reports/lineups/lineup-results-${shard}/vitest.json`, report);
    put(`reports/lineups/lineup-results-${shard}/ci/lineup.json`, { ...ids, shard, total: LINEUP_SHARDS });
    unitDiscovery.push({ file, name: title });
  }
  put("reports/ci/unit-discovery.json", unitDiscovery);
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
  const shardPath = "reports/shards/browser-shard-1/reports/ci/shard.json";
  return { root, ids, build, jobs, put, run, shardPath };
}

it("accepts mixed successful attempts of the same run and records their build evidence", async () => {
  const { root, ids, build, jobs, put, run, shardPath } = await gateFixture();
  const green = run();
  expect(green.stderr).toBe("");
  expect(green.status).toBe(0);
  expect(run(jobs, "2").status).toBe(0);
  // A failed consumer reruns against the unchanged build while other successful jobs are reused.
  put("reports/ci/unit.json", { ...ids, attempt: "2" });
  put("reports/lineups/lineup-results-1/ci/lineup.json", {
    ...ids,
    attempt: "2",
    shard: 1,
    total: LINEUP_SHARDS,
  });
  put("reports/interactions/ci/evidence.json", { ...ids, attempt: "2", build });
  put(shardPath, {
    ...ids,
    attempt: "2",
    build,
    shard: 1,
    workers: 1,
    total: 1,
  });
  const mixed = {
    ...jobs,
    unit: { result: "success", outputs: { attempt: "2" } },
    interactions: { result: "success", outputs: { attempt: "2" } },
  };
  expect(run(mixed, "2").status).toBe(0);
  const record = JSON.parse(readFileSync(path.join(root, "reports/ci/evidence.json"), "utf8"));
  expect(record.build.attempt).toBe("1");
  expect(record.interaction.attempt).toBe("2");
  expect(record.lineups.map((shard) => shard.attempt)).toEqual(
    Array.from({ length: LINEUP_SHARDS }, (_, index) => (index === 0 ? "2" : "1")),
  );
  expect(JSON.parse(readFileSync(path.join(root, "reports/vitest-merged.json"), "utf8")).numPassedTests).toBe(
    LINEUP_SHARDS + 1,
  );
  expect(readFileSync(path.join(root, "summary.md"), "utf8")).toContain("Lineup spread: 0.0s");
  expect(readFileSync(path.join(root, "summary.md"), "utf8")).toContain("All required jobs succeeded");
});

it("rejects unrelated, future and mismatched executable gate evidence", async () => {
  const { ids, build, jobs, put, run, shardPath } = await gateFixture();
  for (const change of [
    { sha: "other" },
    { run: "other" },
    { attempt: "3" },
    { build: "b".repeat(64) },
    { workers: 2 },
  ]) {
    put(shardPath, { ...ids, build, shard: 1, workers: 1, total: 1, ...change });
    expect(run(jobs, "2").status).not.toBe(0);
  }
  put(shardPath, { ...ids, build, shard: 1, workers: 1, total: 1 });
  put("reports/ci/unit.json", { ...ids, attempt: "2" });
  expect(run(jobs, "2").status).not.toBe(0);
  put("reports/ci/unit.json", ids);
  put("reports/interactions/ci/evidence.json", { ...ids, build: "b".repeat(64) });
  expect(run(jobs, "2").status).not.toBe(0);
  put("reports/interactions/ci/evidence.json", { ...ids, build });
});

it("accepts and records a complete two-worker browser benchmark", async () => {
  const { root, run } = await gateFixture(2);
  const result = run();
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(
    JSON.parse(readFileSync(path.join(root, "reports/ci/browser-timings.json"), "utf8")).workersPerJob,
  ).toBe(2);
});

it("fails the executable gate for upstream failures and missing reports", async () => {
  const { root, jobs, run } = await gateFixture();
  for (const job of ["static", "browser", "lineups", "windows"])
    expect(run({ ...jobs, [job]: { result: "failure" } }).status).not.toBe(0);
  for (const file of [
    "reports/ci/unit.json",
    "reports/ci/unit-discovery.json",
    "reports/lineups/lineup-results-1/vitest.json",
    "reports/lineups/lineup-results-4/ci/lineup.json",
    "reports/interactions/ci/evidence.json",
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
});

it("rejects stale lineup evidence, swapped shards and duplicate lineup results", async () => {
  const { root, ids, put, run } = await gateFixture();
  const metadata = "reports/lineups/lineup-results-1/ci/lineup.json";
  for (const change of [{ sha: "other" }, { run: "other" }, { attempt: "2" }, { shard: 2 }, { total: 3 }]) {
    put(metadata, { ...ids, shard: 1, total: LINEUP_SHARDS, ...change });
    expect(run().status).not.toBe(0);
  }
  put(metadata, { ...ids, shard: 1, total: LINEUP_SHARDS });
  const report = JSON.parse(
    readFileSync(path.join(root, "reports/lineups/lineup-results-1/vitest.json"), "utf8"),
  );
  put("reports/lineups/lineup-results-2/vitest.json", report);
  expect(run().stderr).toContain("duplicate unit case");
});

it("rejects interrupted executable shards and invalid attempt identities", async () => {
  const { ids, put, run } = await gateFixture();
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
    workers: 1,
    total: 1,
  });
  expect(run().status).not.toBe(0);
});

it("ships portable merged JSON attachments and rejects missing resources", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fauna-ci-evidence-"));
  const script = path.resolve(import.meta.dirname, "../../../scripts/ci/ci.mjs");
  try {
    mkdirSync(path.join(root, "reports"));
    mkdirSync(path.join(root, "all-blob-reports/resources"), { recursive: true });
    mkdirSync(path.join(root, "reports/browser-html/data"), { recursive: true });
    const image = path.join(root, "all-blob-reports/resources/frame.png");
    writeFileSync(image, "image bytes");
    writeFileSync(path.join(root, "reports/browser-html/data/content-hash.png"), "image bytes");
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
      "browser-html/data/content-hash.png",
    );
    expect(readFileSync(path.join(root, "reports/browser-html/data/content-hash.png"), "utf8")).toBe(
      "image bytes",
    );
    writeFileSync(path.join(root, "reports/playwright.json"), JSON.stringify(report));
    rmSync(path.join(root, "reports/browser-html/data/content-hash.png"));
    expect(run().status).not.toBe(0);
    writeFileSync(path.join(root, "reports/browser-html/data/content-hash.png"), "different bytes");
    expect(run().status).not.toBe(0);
    writeFileSync(path.join(root, "reports/browser-html/data/content-hash.png"), "image bytes");
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
    expect(run("unit").status).toBe(0);
    expect(JSON.parse(readFileSync(path.join(root, "reports/ci/unit.json"), "utf8")).attempt).toBe("1");
    expect(run("interaction", { GITHUB_RUN_ATTEMPT: "2" }).status).toBe(0);
    expect(
      JSON.parse(readFileSync(path.join(root, "reports/interactions/ci/evidence.json"), "utf8")).build,
    ).toBe(buildFingerprint(JSON.parse(readFileSync(path.join(root, "reports/ci/build.json"), "utf8"))));
    writeFileSync(path.join(root, "reports/playwright.json"), JSON.stringify({ config: { workers: 2 } }));
    expect(run("shard", { GITHUB_RUN_ATTEMPT: "2", CI_SHARD: "1", CI_SHARDS: "8" }).status).toBe(0);
    expect(JSON.parse(readFileSync(path.join(root, "reports/ci/shard.json"), "utf8"))).toMatchObject({
      attempt: "2",
      shard: 1,
      total: 8,
      workers: 2,
    });
    expect(run("verify-build", { GITHUB_RUN_ATTEMPT: "2" }).status).toBe(0);
    expect(run("verify-build", { GITHUB_RUN_ATTEMPT: "0" }).status).not.toBe(0);
    expect(run("verify-build", { GITHUB_RUN_ID: "other" }).status).not.toBe(0);
    expect(run("verify-build", { GITHUB_SHA: "another commit" }).status).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("duration-balanced browser planning", () => {
  const discovery = (durations) => ({
    suites: [
      {
        title: "journey.spec.ts",
        file: "journey.spec.ts",
        line: 0,
        suites: [
          {
            title: "keyboard",
            file: "journey.spec.ts",
            line: 10,
            specs: durations.map((duration, index) => ({
              id: `case-${index}`,
              file: "journey.spec.ts",
              title: `case ${index}`,
              tests: [{ projectName: "chromium", results: [{ status: "passed", duration }] }],
            })),
          },
        ],
      },
    ],
    errors: [],
  });
  it("keeps every case once, uses full title paths and separates expensive journeys", () => {
    const report = discovery([40_000, 17_000, 13_000, 12_000, 8_000, 4_000, 4_000, 3_000]);
    const estimates = browserDurations(report);
    const plan = planBrowserShards(report, estimates, 4);
    expect(
      plan
        .flatMap((shard) => shard.tests)
        .map((test) => test.id)
        .sort(),
    ).toEqual(Array.from({ length: 8 }, (_, index) => `case-${index}:chromium`));
    expect(plan[0].tests).toHaveLength(1);
    expect(plan[0].tests[0].list).toBe("[chromium] › journey.spec.ts › keyboard › case 0");
    expect(Math.max(...plan.map((shard) => shard.estimatedMs))).toBe(40_000);
    expect(planBrowserShards(report, estimates, 4)).toEqual(plan);
  });
  it("runs new cases with a default estimate and rejects invalid estimates or duplicate identities", () => {
    const report = discovery([1000, 2000, 3000, 4000]);
    expect(planBrowserShards(report, {}, 4).every((shard) => shard.tests.length === 1)).toBe(true);
    const durations = browserDurations(report);
    durations[Object.keys(durations)[0]] = -1;
    expect(() => planBrowserShards(report, durations, 4)).toThrow("Invalid duration");
    expect(() => planBrowserShards(report, {}, 8)).toThrow("Invalid shard count");
    expect(() => planBrowserShards(combine(report, report), {}, 4)).toThrow("duplicate");
    const failed = discovery([1000]);
    failed.suites[0].suites[0].specs[0].tests[0].results[0].status = "failed";
    expect(browserDurations(failed)).toEqual({});
  });
});

it("reuses identical build bytes across attempts and rejects changed, empty or invalid inventories", () => {
  const manifest = {
    sha: "commit",
    run: "123",
    attempt: "1",
    files: { "dist/a.js": "a".repeat(64), "dist/b.js": "b".repeat(64) },
  };
  const evidence = { sha: "commit", run: "123", attempt: "2", build: buildFingerprint(manifest) };
  expect(() =>
    validateBuildEvidence(evidence, {
      ...manifest,
      attempt: "3",
      files: { "dist/b.js": "b".repeat(64), "dist/a.js": "a".repeat(64) },
    }),
  ).not.toThrow();
  for (const change of [
    { sha: "other" },
    { run: "other" },
    { files: {} },
    { files: { "dist/a.js": "bad" } },
    { files: { "dist/a.js": "c".repeat(64) } },
  ])
    expect(() => validateBuildEvidence(evidence, { ...manifest, ...change })).toThrow();
});
