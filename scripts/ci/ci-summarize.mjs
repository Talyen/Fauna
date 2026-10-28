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
      .replace(/[&<>`*|[\]]/g, (char) => `&#${char.charCodeAt(0)};`) ?? ""
  );
}
function count(value) {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid test count in report.");
  return value;
}

function slowUnitTests(report) {
  const fileName = (file) => {
    const normalized = String(file ?? "").replaceAll("\\", "/");
    return text(normalized.slice(normalized.lastIndexOf("/tests/") + 1));
  };
  const retainSlowest = (rows, row) => {
    if (!Number.isFinite(row.duration) || row.duration < 0) return;
    const index = rows.findIndex(
      (other) =>
        other.duration < row.duration ||
        (other.duration === row.duration && row.name.localeCompare(other.name) < 0),
    );
    if (index >= 0) rows.splice(index, 0, row);
    else if (rows.length < 10) rows.push(row);
    if (rows.length > 10) rows.pop();
  };
  const suiteRows = [],
    testRows = [];
  for (const suite of report.testResults) {
    const name = fileName(suite.name);
    if (Number.isFinite(suite.startTime) && Number.isFinite(suite.endTime))
      retainSlowest(suiteRows, { name, duration: suite.endTime - suite.startTime });
    for (const test of suite.assertionResults ?? [])
      retainSlowest(testRows, {
        name: `${name} — ${text(test.fullName ?? test.title)}`,
        duration: test.duration,
      });
  }
  const format = (rows) => rows.map((row) => `- ${(row.duration / 1000).toFixed(2)}s — ${row.name}`);
  const suites = format(suiteRows),
    tests = format(testRows);
  return [
    ...(suites.length ? ["", "Slowest test files (each shard measured separately):", ...suites] : []),
    ...(tests.length ? ["", "Slowest tests:", ...tests] : []),
  ];
}

function errorText(error) {
  return text(error?.message || error?.value || error?.stack || error);
}

export function summarizeReport(kind, report) {
  if (!report || typeof report !== "object") throw new Error("Invalid report object.");
  const failures = [],
    errors = [];
  let passed = 0,
    failed = 0,
    skipped = 0,
    flaky = 0,
    todo = 0,
    expectedFailures = 0;
  if (kind === "vitest") {
    if (!Array.isArray(report.testResults)) throw new Error("Vitest report has no testResults array.");
    passed = count(report.numPassedTests);
    failed = count(report.numFailedTests);
    skipped = count(report.numPendingTests);
    todo = count(report.numTodoTests);
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
            if (test.status === "expected" && test.expectedStatus === "failed") expectedFailures++;
            if (!["expected", "unexpected", "flaky", "skipped"].includes(test.status))
              errors.push("Browser test has an unknown outcome.");
            if (test.status === "unexpected" || test.status === "flaky") {
              if (test.status === "unexpected") observedFailed++;
              else observedFlaky++;
              const result =
                test.results?.findLast((row) => row.errors?.length || row.error) ?? test.results?.at(-1);
              const attachmentPaths = new Set();
              for (const row of test.results ?? [])
                for (const attachment of row.attachments ?? [])
                  if (typeof attachment.path === "string" && attachment.path)
                    attachmentPaths.add(attachment.path);
              const attachments = [...attachmentPaths].slice(0, 10).map(text);
              const extraAttachments = attachmentPaths.size - attachments.length;
              const detail =
                errorText(result?.errors?.[0] ?? result?.error) ||
                (result?.status === "interrupted"
                  ? "Test was interrupted."
                  : "No error details; inspect the report.");
              failures.push(
                `${text(spec.file)}:${count(spec.line)} — ${text(spec.title)}${test.projectName ? ` [${text(test.projectName)}]` : ""} (${text(test.status)}): ${detail}${attachments.length ? `; evidence: ${attachments.join(", ")}${extraAttachments ? `; ${extraAttachments} more attachments in the JSON report` : ""}` : ""}`,
              );
            }
          }
        walk(suite.suites ?? []);
      }
    };
    walk(report.suites);
    passed = Math.max(0, passed - expectedFailures);
    failed = Math.max(failed, observedFailed);
    flaky = Math.max(flaky, observedFlaky);
    errors.push(...(report.errors ?? []).map(errorText));
  } else throw new Error(`Unknown report kind: ${kind}`);
  return (
    [
      `## ${kind === "vitest" ? "Unit tests" : "Browser tests"}`,
      "",
      `Passed: ${passed}; failed: ${failed}; skipped: ${skipped}; flaky: ${flaky}.`,
      ...(todo ? [`TODO: ${todo}.`] : []),
      ...(expectedFailures ? [`Expected failures: ${expectedFailures}.`] : []),
      ...errors.slice(0, 10).map((error) => `- Runner error: ${error}`),
      ...(errors.length > 10 ? [`- ${errors.length - 10} more runner errors; see the JSON report.`] : []),
      ...failures.slice(0, 10).map((failure) => `- ${failure}`),
      ...(failures.length > 10 ? [`- ${failures.length - 10} more failures; see the JSON report.`] : []),
      ...(kind === "vitest" ? slowUnitTests(report) : []),
      ...(kind === "playwright"
        ? [
            "",
            "Merged report and portable attachments: browser-review; raw screenshots and traces: browser-shard-N artifacts.",
          ]
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
    throw new Error("Usage: node scripts/ci/ci-summarize.mjs <vitest|playwright> <report.json>");
  publishSummary(kind, file);
}
