import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { identity as interactionIdentity } from "./lib/tool-runtime.mjs";

const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const write = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
};
const identity = () => ({
  sha: process.env.GITHUB_SHA,
  run: process.env.GITHUB_RUN_ID,
  attempt: process.env.GITHUB_RUN_ATTEMPT,
});
function assertIdentity(value) {
  for (const [key, expected] of Object.entries(identity()))
    if (!expected || value[key] !== expected) throw new Error(`CI ${key} identity mismatch`);
}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? files(file) : [file];
    })
    .sort();
}
function buildHashes() {
  return Object.fromEntries(
    files("dist").map((file) => [file, createHash("sha256").update(readFileSync(file)).digest("hex")]),
  );
}
export function browserCases(report) {
  if (!Array.isArray(report.suites) || report.errors?.length)
    throw new Error("Invalid browser report or runner errors");
  const cases = [];
  function walk(suites) {
    for (const suite of suites) {
      for (const spec of suite.specs ?? [])
        for (const test of spec.tests ?? [])
          cases.push({ id: `${spec.id}:${test.projectName}`, title: spec.title, test });
      walk(suite.suites ?? []);
    }
  }
  walk(report.suites);
  if (!cases.length || new Set(cases.map((row) => row.id)).size !== cases.length)
    throw new Error("Empty or duplicate browser cases");
  return cases;
}
export function validateBrowserCoverage(discovery, reports) {
  const expected = new Map(browserCases(discovery).map((row) => [row.id, row]));
  const observed = new Set();
  for (const report of reports) {
    for (const row of browserCases(report)) {
      if (!expected.has(row.id) || observed.has(row.id))
        throw new Error(`Unexpected or duplicate browser test: ${row.title}`);
      observed.add(row.id);
      const results = row.test.results ?? [];
      const developmentSkip =
        row.title === "development skip wins once through normal rewards" &&
        row.test.status === "skipped" &&
        results.length === 1 &&
        results[0].status === "skipped" &&
        row.test.annotations?.some(
          (annotation) =>
            annotation.type === "skip" &&
            annotation.description === "Requires an explicitly owned development preview.",
        );
      if (
        !developmentSkip &&
        (row.test.status !== "expected" ||
          row.test.expectedStatus !== "passed" ||
          results.length !== 1 ||
          results[0].status !== "passed" ||
          results[0].retry !== 0)
      )
        throw new Error(`Browser test did not pass on its first attempt: ${row.title}`);
    }
  }
  if (observed.size !== expected.size)
    throw new Error(`Incomplete browser coverage: ${observed.size}/${expected.size}`);
  return observed.size;
}
export function validateJobs(needs) {
  const names = ["prepare", "static", "unit", "build", "browser", "interactions", "windows"];
  for (const name of names)
    if (needs[name]?.result !== "success")
      throw new Error(`Required job ${name}: ${needs[name]?.result ?? "missing"}`);
}
export function validateUnit(report) {
  if (
    report.success !== true ||
    report.numFailedTests !== 0 ||
    report.numFailedTestSuites !== 0 ||
    report.numPendingTests !== 0 ||
    report.numPendingTestSuites !== 0 ||
    report.numTotalTests < 1 ||
    report.numPassedTests !== report.numTotalTests ||
    !report.testResults?.length
  )
    throw new Error("Incomplete or failed unit results");
}
export function validateInteraction(report, expectedIdentity) {
  if (
    report.complete !== true ||
    report.failure !== null ||
    report.identity !== expectedIdentity ||
    report.seed !== 42 ||
    report.actions?.length !== 12
  )
    throw new Error("Incomplete or mismatched interaction trace");
}
async function main(command) {
  if (command === "prepare") {
    const event = read(process.env.GITHUB_EVENT_PATH);
    const count = Number(event.inputs?.shards ?? 8);
    if (![1, 4, 8].includes(count)) throw new Error("Expected 1, 4 or 8 shards");
    let run = true;
    if (
      process.env.GITHUB_EVENT_NAME === "push" &&
      process.env.GITHUB_REF.startsWith("refs/heads/") &&
      process.env.GITHUB_REF !== "refs/heads/main"
    ) {
      const owner = process.env.GITHUB_REPOSITORY.split("/")[0];
      const query = new URLSearchParams({
        state: "open",
        head: `${owner}:${process.env.GITHUB_REF_NAME}`,
        per_page: "1",
      });
      const response = await fetch(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pulls?${query}`,
        {
          headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: "application/vnd.github+json" },
        },
      );
      if (!response.ok) throw new Error(`Cannot inspect duplicate PR runs: ${response.status}`);
      run = (await response.json()).length === 0;
    }
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `run=${run}\nshards=${JSON.stringify(Array.from({ length: count }, (_, i) => i + 1))}\ntotal=${count}\n`,
    );
  } else if (command === "build") {
    write("reports/ci/build.json", {
      ...identity(),
      environment: {
        node: process.version,
        image: process.env.ImageOS,
        imageVersion: process.env.ImageVersion,
      },
      files: buildHashes(),
    });
  } else if (command === "verify-build") {
    const manifest = read("reports/ci/build.json");
    assertIdentity(manifest);
    if (JSON.stringify(manifest.files) !== JSON.stringify(buildHashes()))
      throw new Error("Downloaded build differs from this run's build");
  } else if (command === "shard") {
    write("reports/ci/shard.json", {
      ...identity(),
      shard: Number(process.env.CI_SHARD),
      total: Number(process.env.CI_SHARDS),
      environment: {
        node: process.version,
        image: process.env.ImageOS,
        imageVersion: process.env.ImageVersion,
      },
    });
  } else if (command === "collect") {
    mkdirSync("all-blob-reports", { recursive: true });
    for (const file of files("reports/shards").filter(
      (file) => file.endsWith(".zip") && file.includes("blob-report"),
    ))
      copyFileSync(file, path.join("all-blob-reports", `${file.split(path.sep)[2]}-${path.basename(file)}`));
  } else if (command === "portable") {
    const report = read("reports/playwright.json");
    mkdirSync("reports/browser-resources", { recursive: true });
    for (const row of browserCases(report))
      for (const result of row.test.results ?? [])
        for (const attachment of result.attachments ?? []) {
          if (!attachment.path) continue;
          const source = realpathSync(attachment.path);
          if (!source.startsWith(realpathSync("all-blob-reports/resources") + path.sep))
            throw new Error("Merged attachment is outside blob resources");
          const relative = `browser-resources/${path.basename(source)}`;
          copyFileSync(source, path.join("reports", relative));
          attachment.path = relative;
        }
    write("reports/playwright.json", report);
  } else if (command === "gate") {
    validateJobs(JSON.parse(process.env.CI_NEEDS));
    const total = Number(process.env.CI_SHARDS);
    if (![1, 4, 8].includes(total)) throw new Error("Invalid shard count");
    assertIdentity(read("reports/ci/build.json"));
    const reports = [];
    for (let shard = 1; shard <= total; shard++) {
      const root = `reports/shards/browser-shard-${shard}`;
      const metadata = read(`${root}/reports/ci/shard.json`);
      assertIdentity(metadata);
      if (metadata.shard !== shard || metadata.total !== total) throw new Error("Wrong shard identity");
      reports.push(read(`${root}/reports/playwright.json`));
    }
    const discovery = read("reports/ci/discovery.json");
    const count = validateBrowserCoverage(discovery, reports);
    validateBrowserCoverage(discovery, [read("reports/playwright.json")]);
    validateUnit(read("reports/vitest.json"));
    validateInteraction(read("reports/interactions/ci/report.json"), await interactionIdentity());
    const slowest = reports
      .flatMap((report) =>
        browserCases(report).map((row) => ({
          title: row.title,
          duration: row.test.results?.[0]?.duration ?? 0,
        })),
      )
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    write("reports/ci/browser-timings.json", {
      ...identity(),
      shards: reports.map((report, index) => ({ shard: index + 1, duration: report.stats?.duration })),
      slowest,
    });
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\nAll required jobs succeeded; ${count} browser cases accounted for across ${total} shards\n`,
    );
  } else throw new Error(`Unknown CI command: ${command}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main(process.argv[2]);
