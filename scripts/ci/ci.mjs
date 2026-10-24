import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  realpathSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateInteractionReport } from "../lib/interaction-replay.mjs";
import { identity as interactionIdentity } from "../lib/tool-runtime.mjs";
import { LINEUP_SHARDS } from "./unit-shards.mjs";

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
function assertIdentity(value, expectedAttempt) {
  const current = identity();
  for (const key of ["sha", "run"])
    if (!current[key] || value[key] !== current[key]) throw new Error(`CI ${key} identity mismatch`);
  if (!validAttempt(value.attempt, current.attempt) || (expectedAttempt && value.attempt !== expectedAttempt))
    throw new Error("CI attempt identity mismatch");
}
function validAttempt(attempt, current) {
  return (
    /^[1-9]\d*$/.test(attempt ?? "") && /^[1-9]\d*$/.test(current ?? "") && Number(attempt) <= Number(current)
  );
}
export function buildFingerprint(manifest) {
  if (
    !manifest.files ||
    !Object.keys(manifest.files).length ||
    Object.values(manifest.files).some((hash) => !/^[a-f0-9]{64}$/.test(hash))
  )
    throw new Error("Missing or invalid build hashes");
  return createHash("sha256")
    .update(JSON.stringify(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b, "en"))))
    .digest("hex");
}
export function validateBuildEvidence(evidence, manifest) {
  for (const key of ["sha", "run"])
    if (!manifest[key] || evidence[key] !== manifest[key]) throw new Error(`CI ${key} identity mismatch`);
  if (evidence.build !== buildFingerprint(manifest)) throw new Error("Evidence tested a different build");
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
  function walk(suites, parents = []) {
    for (const suite of suites) {
      const titles = suite.title && suite.line !== 0 ? [...parents, suite.title] : parents;
      for (const spec of suite.specs ?? [])
        for (const test of spec.tests ?? [])
          cases.push({
            id: `${spec.id}:${test.projectName}`,
            title: spec.title,
            list: `[${test.projectName}] › ${spec.file} › ${[...titles, spec.title].join(" › ")}`,
            test,
          });
      walk(suite.suites ?? [], titles);
    }
  }
  walk(report.suites);
  if (!cases.length || new Set(cases.map((row) => row.id)).size !== cases.length)
    throw new Error("Empty or duplicate browser cases");
  return cases;
}
/** Largest-first assignment keeps slow journeys apart; estimates never select coverage. */
export function planBrowserShards(discovery, estimates, total) {
  const cases = browserCases(discovery);
  if (![1, 4, 8].includes(total) || cases.length < total) throw new Error("Invalid shard count");
  const shards = Array.from({ length: total }, (_, index) => ({
    shard: index + 1,
    estimatedMs: 0,
    tests: [],
  }));
  const weighted = cases.map(({ id, list }) => {
    const estimate = Object.hasOwn(estimates, list) ? estimates[list] : 2000;
    if (!Number.isFinite(estimate) || estimate < 0) throw new Error(`Invalid duration: ${list}`);
    return { id, list, estimatedMs: Math.max(1, estimate) };
  });
  weighted.sort((a, b) => b.estimatedMs - a.estimatedMs || a.list.localeCompare(b.list, "en"));
  for (const row of weighted) {
    const shard = shards.reduce((a, b) => (a.estimatedMs <= b.estimatedMs ? a : b));
    shard.tests.push(row);
    shard.estimatedMs += row.estimatedMs;
  }
  return shards;
}

export function browserDurations(report) {
  return Object.fromEntries(
    browserCases(report)
      .filter((row) => row.test.results?.length === 1 && row.test.results[0].status === "passed")
      .map((row) => [row.list, row.test.results[0].duration])
      .sort(([a], [b]) => a.localeCompare(b, "en")),
  );
}

/** JSON and HTML share the HTML reporter's content-addressed attachment store. */
export function portableAttachments(report, root = ".") {
  const resources = path.resolve(root, "all-blob-reports/resources");
  const data = path.resolve(root, "reports/browser-html/data");
  const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
  const byHash = new Map((existsSync(data) ? files(data) : []).map((file) => [hash(file), file]));
  for (const row of browserCases(report))
    for (const result of row.test.results ?? [])
      for (const attachment of result.attachments ?? []) {
        if (!attachment.path) continue;
        const source = realpathSync(path.resolve(root, attachment.path));
        if (!source.startsWith(realpathSync(resources) + path.sep))
          throw new Error("Merged attachment is outside blob resources");
        const target = byHash.get(hash(source));
        if (!target) throw new Error(`Missing HTML attachment: ${attachment.name}`);
        attachment.path = path.relative(path.resolve(root, "reports"), target).split(path.sep).join("/");
      }
  return report;
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
export function validateJobs(needs, attempt) {
  if (!attempt) throw new Error("Missing workflow attempt");
  const names = ["prepare", "static", "unit", "lineups", "build", "browser", "interactions", "windows"];
  for (const name of names) {
    if (needs[name]?.result !== "success")
      throw new Error(`Required job ${name}: ${needs[name]?.result ?? "missing"}`);
    if (!["browser", "lineups"].includes(name) && !validAttempt(needs[name].outputs?.attempt, attempt))
      throw new Error(`Required job ${name} has an invalid workflow attempt`);
  }
}
export function validateUnit(report) {
  if (
    report.success !== true ||
    report.numFailedTests !== 0 ||
    report.numFailedTestSuites !== 0 ||
    report.numPendingTests !== 0 ||
    report.numPendingTestSuites !== 0 ||
    !Number.isSafeInteger(report.numTotalTests) ||
    report.numTotalTests < 1 ||
    report.numPassedTests !== report.numTotalTests ||
    !Array.isArray(report.testResults) ||
    !report.testResults.length ||
    report.testResults.some((suite) => suite.status !== "passed" || !Array.isArray(suite.assertionResults)) ||
    report.testResults.flatMap((suite) => suite.assertionResults).length !== report.numTotalTests ||
    report.testResults.some((suite) => suite.assertionResults.some((test) => test.status !== "passed"))
  )
    throw new Error("Incomplete or failed unit results");
}

function unitCase(file, name) {
  const normalized = file?.replaceAll("\\", "/");
  const relative = normalized?.slice(normalized.lastIndexOf("/tests/") + 1);
  if (!relative?.startsWith("tests/") || typeof name !== "string" || !name)
    throw new Error("Invalid unit case identity");
  return JSON.stringify([relative, name]);
}

/** Parameterized tests may share titles; require their exact discovered multiplicity. */
export function validateUnitCoverage(discovery, reports) {
  if (!Array.isArray(discovery) || !discovery.length) throw new Error("Empty unit discovery");
  const expected = new Map();
  for (const row of discovery) {
    const id = unitCase(row.file, row.name);
    expected.set(id, (expected.get(id) ?? 0) + 1);
  }
  let observed = 0;
  for (const report of reports) {
    validateUnit(report);
    for (const suite of report.testResults)
      for (const test of suite.assertionResults) {
        const id = unitCase(suite.name, [...(test.ancestorTitles ?? []), test.title].join(" > "));
        const remaining = expected.get(id) ?? 0;
        if (!remaining) throw new Error(`Unexpected or duplicate unit case: ${id}`);
        expected.set(id, remaining - 1);
        observed++;
      }
  }
  if ([...expected.values()].some((remaining) => remaining !== 0))
    throw new Error(`Incomplete unit coverage: ${observed}/${discovery.length}`);
  return observed;
}

export function mergeUnitReports(discovery, reports) {
  validateUnitCoverage(discovery, reports);
  const merged = {
    ...reports[0],
    startTime: Math.min(...reports.map((report) => report.startTime)),
    testResults: reports.flatMap((report) => report.testResults),
  };
  for (const key of [
    "numTotalTestSuites",
    "numPassedTestSuites",
    "numFailedTestSuites",
    "numPendingTestSuites",
    "numTotalTests",
    "numPassedTests",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
  ])
    merged[key] = reports.reduce((sum, report) => sum + (report[key] ?? 0), 0);
  return merged;
}
export function validateInteraction(report, expectedIdentity) {
  validateInteractionReport(report);
  if (
    report.complete !== true ||
    report.failure !== null ||
    report.identity !== expectedIdentity ||
    report.seed !== 42 ||
    report.family !== "mixed" ||
    report.actions.length !== 12 ||
    report.actions.some((action) => !/^[a-f0-9]{64}$/.test(action.checkpointHash))
  )
    throw new Error("Incomplete or mismatched interaction trace");
}
async function main(command) {
  if (command === "prepare") {
    const event = read(process.env.GITHUB_EVENT_PATH);
    const count = Number(event.inputs?.shards ?? 8);
    if (![1, 4, 8].includes(count)) throw new Error("Expected 1, 4 or 8 shards");
    const runtime = event.inputs?.browser_runtime ?? "container";
    if (!["install", "container"].includes(runtime)) throw new Error("Invalid browser runtime");
    const version = read("package-lock.json").packages["node_modules/@playwright/test"].version;
    const image = runtime === "container" ? `mcr.microsoft.com/playwright:v${version}-noble` : "";
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
      `browser_image=${image}\nattempt=${process.env.GITHUB_RUN_ATTEMPT}\nrun=${run}\nshards=${JSON.stringify(Array.from({ length: count }, (_, i) => i + 1))}\ntotal=${count}\n`,
    );
  } else if (command === "stamp") {
    appendFileSync(process.env.GITHUB_OUTPUT, `attempt=${process.env.GITHUB_RUN_ATTEMPT}\n`);
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
  } else if (command === "unit") {
    write("reports/ci/unit.json", identity());
  } else if (command === "lineup") {
    const shard = Number(process.env.FAUNA_LINEUP_SHARD);
    if (!Number.isInteger(shard) || shard < 1 || shard > LINEUP_SHARDS)
      throw new Error("Invalid lineup shard");
    write("reports/ci/lineup.json", { ...identity(), shard, total: LINEUP_SHARDS });
  } else if (command === "interaction") {
    const manifest = read("reports/ci/build.json");
    assertIdentity(manifest);
    write("reports/interactions/ci/evidence.json", { ...identity(), build: buildFingerprint(manifest) });
  } else if (command === "shard") {
    const manifest = read("reports/ci/build.json");
    assertIdentity(manifest);
    write("reports/ci/shard.json", {
      ...identity(),
      build: buildFingerprint(manifest),
      shard: Number(process.env.CI_SHARD),
      total: Number(process.env.CI_SHARDS),
      environment: {
        node: process.version,
        image: process.env.ImageOS,
        imageVersion: process.env.ImageVersion,
        browserImage: process.env.FAUNA_BROWSER_IMAGE || null,
      },
    });
  } else if (command === "collect") {
    mkdirSync("all-blob-reports", { recursive: true });
    for (const file of files("reports/shards").filter(
      (file) => file.endsWith(".zip") && file.includes("blob-report"),
    ))
      copyFileSync(file, path.join("all-blob-reports", `${file.split(path.sep)[2]}-${path.basename(file)}`));
  } else if (command === "portable") {
    write("reports/playwright.json", portableAttachments(read("reports/playwright.json")));
  } else if (command === "plan") {
    const shards = planBrowserShards(
      read("reports/ci/discovery.json"),
      read("scripts/ci/browser-durations.json"),
      Number(process.env.CI_SHARDS),
    );
    write("reports/ci/browser-plan.json", { ...identity(), shards });
    for (const shard of shards)
      writeFileSync(
        `reports/ci/shard-${shard.shard}.txt`,
        shard.tests.map((row) => row.list).join("\n") + "\n",
      );
  } else if (command === "durations") {
    write("reports/ci/browser-durations.json", browserDurations(read("reports/playwright.json")));
  } else if (command === "gate") {
    const needs = JSON.parse(process.env.CI_NEEDS);
    validateJobs(needs, process.env.GITHUB_RUN_ATTEMPT);
    const total = Number(process.env.CI_SHARDS);
    if (![1, 4, 8].includes(total)) throw new Error("Invalid shard count");
    const manifest = read("reports/ci/build.json");
    assertIdentity(manifest, needs.build.outputs.attempt);
    const unit = read("reports/ci/unit.json");
    assertIdentity(unit, needs.unit.outputs.attempt);
    const interaction = read("reports/interactions/ci/evidence.json");
    assertIdentity(interaction, needs.interactions.outputs.attempt);
    validateBuildEvidence(interaction, manifest);
    const reports = [];
    const evidence = { ...identity(), build: manifest, unit, interaction, lineups: [], shards: [] };
    const unitReports = [read("reports/vitest.json")];
    for (let shard = 1; shard <= LINEUP_SHARDS; shard++) {
      const root = `reports/lineups/lineup-results-${shard}`;
      const metadata = read(`${root}/ci/lineup.json`);
      assertIdentity(metadata);
      if (metadata.shard !== shard || metadata.total !== LINEUP_SHARDS)
        throw new Error("Wrong lineup shard identity");
      evidence.lineups.push(metadata);
      unitReports.push(read(`${root}/vitest.json`));
    }
    const mergedUnit = mergeUnitReports(read("reports/ci/unit-discovery.json"), unitReports);
    write("reports/vitest-merged.json", mergedUnit);
    const unitShards = unitReports.map((report, index) => ({
      group: index === 0 ? "contracts" : `lineups-${index}`,
      duration: Math.max(...report.testResults.map((suite) => suite.endTime)) - report.startTime,
    }));
    write("reports/ci/unit-timings.json", { ...identity(), shards: unitShards });
    for (let shard = 1; shard <= total; shard++) {
      const root = `reports/shards/browser-shard-${shard}`;
      const metadata = read(`${root}/reports/ci/shard.json`);
      assertIdentity(metadata);
      validateBuildEvidence(metadata, manifest);
      if (metadata.shard !== shard || metadata.total !== total) throw new Error("Wrong shard identity");
      evidence.shards.push(metadata);
      reports.push(read(`${root}/reports/playwright.json`));
    }
    const discovery = read("reports/ci/discovery.json");
    const count = validateBrowserCoverage(discovery, reports);
    validateBrowserCoverage(discovery, [read("reports/playwright.json")]);
    validateUnit(mergedUnit);
    validateInteraction(read("reports/interactions/ci/report.json"), await interactionIdentity());
    write("reports/ci/evidence.json", evidence);
    write("reports/ci/browser-durations.json", browserDurations(read("reports/playwright.json")));
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
      `\nAll required jobs succeeded; ${count} browser cases accounted for across ${total} shards\n` +
        `\nUnit coverage: ${mergedUnit.numTotalTests} cases across contracts and ${LINEUP_SHARDS} lineup shards\n` +
        unitShards.map((shard) => `- ${shard.group}: ${(shard.duration / 1000).toFixed(1)}s`).join("\n") +
        `\nLineup spread: ${((Math.max(...unitShards.slice(1).map((shard) => shard.duration)) - Math.min(...unitShards.slice(1).map((shard) => shard.duration))) / 1000).toFixed(1)}s\n`,
    );
  } else throw new Error(`Unknown CI command: ${command}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main(process.argv[2]);
