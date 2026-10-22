import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const seconds = (start, end) =>
  start && end ? Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000) : null;
export function timingReport(run, jobs) {
  return {
    run: run.id,
    attempt: run.run_attempt,
    sha: run.head_sha,
    conclusion: run.conclusion,
    elapsedSeconds: seconds(run.created_at, run.updated_at),
    initialQueueSeconds: seconds(run.created_at, run.run_started_at),
    runnerSeconds: jobs.reduce((sum, job) => sum + (seconds(job.started_at, job.completed_at) ?? 0), 0),
    jobs: jobs.map((job) => ({
      name: job.name,
      conclusion: job.conclusion,
      // Start delay includes dependency waits; GitHub does not expose runner queue time for every job.
      startDelaySeconds: seconds(run.run_started_at, job.started_at),
      executionSeconds: seconds(job.started_at, job.completed_at),
      steps: job.steps.map((step) => ({
        name: step.name,
        conclusion: step.conclusion,
        seconds: seconds(step.started_at, step.completed_at),
      })),
    })),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [id, attempt] = process.argv.slice(2);
  if (!/^\d+$/.test(id ?? "") || (attempt && !/^\d+$/.test(attempt)))
    throw new Error("Usage: node scripts/ci-timings.mjs <run-id> [attempt]");
  const repo =
    process.env.GITHUB_REPOSITORY ??
    execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], {
      encoding: "utf8",
    }).trim();
  const api = (endpoint, paginate = false) =>
    JSON.parse(
      execFileSync(
        "gh",
        [
          "api",
          ...(paginate ? ["--paginate", "--slurp"] : []),
          `repos/${repo}/actions/runs/${id}${endpoint}`,
        ],
        { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      ),
    );
  const run = api(attempt ? `/attempts/${attempt}` : "");
  const jobs = api(`/attempts/${run.run_attempt}/jobs?per_page=100`, true).flatMap((page) => page.jobs);
  const result = timingReport(run, jobs);
  const output = `reports/ci/timings-${id}-${run.run_attempt}.json`;
  mkdirSync("reports/ci", { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
  const summary = `\n## Workflow timings\n\nRun ${id}, attempt ${run.run_attempt}, ${run.head_sha}\n\nElapsed: ${result.elapsedSeconds}s; initial queue: ${result.initialQueueSeconds}s; completed runner time: ${result.runnerSeconds}s\n\n| Job | Execution seconds | Result |\n| --- | ---: | --- |\n${result.jobs.map((job) => `| ${job.name} | ${job.executionSeconds ?? "running"} | ${job.conclusion ?? "pending"} |`).join("\n")}\n\nTiming captured before final artifact upload is provisional; rerun this read-only command after completion for final measurements\n`;
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(output);
}
