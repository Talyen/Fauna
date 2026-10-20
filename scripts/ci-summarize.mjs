import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";

function text(value) {
  return (
    stripVTControlCharacters(String(value ?? ""))
      .split(/\r?\n/)
      .find((line) => line.trim())
      ?.slice(0, 300)
      .replace(/[&<>`*|\[\]]/g, (char) => `&#${char.charCodeAt(0)};`) ?? ""
  );
}
function count(value) {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid test count in report.");
  return value;
}

export function summarizeReport(kind, report) {
  if (!report || typeof report !== "object") throw new Error("Invalid report object.");
  const failures = [],
    errors = [];
  let passed = 0,
    failed = 0,
    skipped = 0,
    flaky = 0;
  if (kind === "vitest") {
    if (!Array.isArray(report.testResults)) throw new Error("Vitest report has no testResults array.");
    passed = count(report.numPassedTests);
    failed = count(report.numFailedTests);
    skipped = count(report.numPendingTests);
    for (const suite of report.testResults) {
      const assertions = suite.assertionResults ?? [];
      for (const row of assertions)
        if (row.status === "failed")
          failures.push(
            `${text(suite.name)} — ${text(row.fullName ?? row.title)}: ${text(row.failureMessages?.[0])}`,
          );
      if (suite.status === "failed" && !assertions.some((row) => row.status === "failed"))
        errors.push(`${text(suite.name)}: ${text(suite.message) || "Suite failed before assertions."}`);
    }
    failed = Math.max(failed, failures.length);
    if ((report.success === false || count(report.numFailedTestSuites) > 0) && !failed && !errors.length)
      errors.push("Runner reported failure without assertion details.");
  } else if (kind === "playwright") {
    if (!Array.isArray(report.suites) || !report.stats)
      throw new Error("Playwright report is missing suites or stats.");
    passed = count(report.stats.expected);
    failed = count(report.stats.unexpected);
    skipped = count(report.stats.skipped);
    flaky = count(report.stats.flaky);
    let observedFailed = 0,
      observedFlaky = 0;
    const walk = (suites) => {
      for (const suite of suites) {
        for (const spec of suite.specs ?? [])
          for (const test of spec.tests ?? []) {
            if (!["expected", "unexpected", "flaky", "skipped"].includes(test.status))
              errors.push("Browser test has an unknown outcome.");
            if (test.status === "unexpected" || test.status === "flaky") {
              if (test.status === "unexpected") observedFailed++;
              else observedFlaky++;
              const result = test.results?.findLast((row) => row.errors?.length);
              const attachments = (test.results ?? [])
                .flatMap((row) => row.attachments ?? [])
                .filter((attachment) => attachment.path)
                .map((attachment) => text(attachment.path));
              failures.push(
                `${text(spec.file)}:${count(spec.line)} — ${text(spec.title)} (${text(test.status)}): ${text(result?.errors?.[0]?.message)}${attachments.length ? `; evidence: ${attachments.join(", ")}` : ""}`,
              );
            }
          }
        walk(suite.suites ?? []);
      }
    };
    walk(report.suites);
    failed = Math.max(failed, observedFailed);
    flaky = Math.max(flaky, observedFlaky);
    errors.push(...(report.errors ?? []).map((error) => text(error.message ?? error)));
  } else throw new Error(`Unknown report kind: ${kind}`);
  return (
    [
      `## ${kind === "vitest" ? "Unit tests" : "Browser tests"}`,
      "",
      `Passed: ${passed}; failed: ${failed}; skipped: ${skipped}; flaky: ${flaky}.`,
      ...errors.slice(0, 10).map((error) => `- Runner error: ${error}`),
      ...failures.slice(0, 10).map((failure) => `- ${failure}`),
      ...(failures.length > 10 ? [`- ${failures.length - 10} more failures; see the JSON report.`] : []),
      ...(kind === "playwright"
        ? ["", "Screenshots and failure traces: browser-review artifact, reports/ and test-results/."]
        : []),
    ].join("\n") + "\n"
  );
}

export function publishSummary(
  kind,
  file,
  { output = process.env.GITHUB_STEP_SUMMARY, log = console.log } = {},
) {
  let summary;
  try {
    summary = summarizeReport(kind, JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    summary = `## ${text(kind)} report unavailable\n\n${text(file)}: ${text(error.message)}\nEarlier static checks or the runner may have failed before producing a report. Inspect the job log.\n`;
  }
  if (output) appendFileSync(output, summary);
  else log(summary);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [kind, file, ...extra] = process.argv.slice(2);
  if (!["vitest", "playwright"].includes(kind) || !file || extra.length)
    throw new Error("Usage: node scripts/ci-summarize.mjs <vitest|playwright> <report.json>");
  publishSummary(kind, file);
}
