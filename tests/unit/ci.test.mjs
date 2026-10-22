import { describe, expect, it } from "vitest";
import {
  validateBrowserCoverage,
  validateJobs,
  validateUnit,
  validateInteraction,
} from "../../scripts/ci.mjs";

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
        { result: "success" },
      ]),
    );
    expect(() => validateJobs(jobs)).not.toThrow();
    for (const name of Object.keys(jobs))
      for (const result of ["failure", "cancelled", "skipped", undefined])
        expect(() => validateJobs({ ...jobs, [name]: { result } })).toThrow(name);
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
      testResults: [{}],
    };
    expect(() => validateUnit(units)).not.toThrow();
    expect(() => validateUnit({ ...units, numPassedTests: 0 })).toThrow();
    expect(() => validateUnit({ ...units, numPendingTests: 1 })).toThrow();
    const trace = {
      complete: true,
      failure: null,
      identity: "current",
      seed: 42,
      actions: Array(12).fill({}),
    };
    expect(() => validateInteraction(trace, "current")).not.toThrow();
    expect(() => validateInteraction({ ...trace, complete: false }, "current")).toThrow();
    expect(() => validateInteraction(trace, "stale")).toThrow();
  });
});
