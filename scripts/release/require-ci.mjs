import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { git } from "../lib/git.mjs";

export function requireVerifiedCI(commit, { repository, runner = execFileSync } = {}) {
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(commit ?? "") || !repository)
    throw new Error("Provide the full release commit and GitHub repository.");
  const deadline = Date.now() + 60_000;
  const gh = (args) => {
    const timeout = deadline - Date.now();
    if (timeout <= 0) throw new Error("CI prerequisite lookup deadline exhausted.");
    return JSON.parse(
      runner("gh", [...args, "--repo", repository], {
        encoding: "utf8",
        timeout,
        maxBuffer: 4_000_000,
      }),
    );
  };
  const runs = gh([
    "run",
    "list",
    "--workflow",
    "ci.yml",
    "--commit",
    commit,
    "--limit",
    "50",
    "--json",
    "databaseId,headSha,conclusion,attempt",
  ]);
  if (!Array.isArray(runs)) throw new Error("Invalid CI run inventory.");
  for (const run of runs) {
    if (
      run.headSha !== commit ||
      run.conclusion !== "success" ||
      !Number.isSafeInteger(run.databaseId) ||
      run.databaseId < 1 ||
      !Number.isSafeInteger(run.attempt) ||
      run.attempt < 1
    )
      continue;
    // A suppressed duplicate can conclude success with every verification job skipped.
    // Pin the listed attempt so a concurrent rerun cannot substitute its job results.
    const detail = gh([
      "run",
      "view",
      String(run.databaseId),
      "--attempt",
      String(run.attempt),
      "--json",
      "headSha,conclusion,attempt,jobs,url",
    ]);
    const gates = detail.jobs?.filter((job) => job.name === "verify");
    if (
      detail.headSha === commit &&
      detail.conclusion === "success" &&
      detail.attempt === run.attempt &&
      gates?.length === 1 &&
      gates[0].status === "completed" &&
      gates[0].conclusion === "success"
    )
      return detail;
  }
  throw new Error("Tagged commit requires successful full CI, including its final verify job.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error("Usage: node scripts/release/require-ci.mjs");
  const commit = git(process.cwd(), ["rev-parse", "HEAD"]).trim();
  const result = requireVerifiedCI(commit, { repository: process.env.GITHUB_REPOSITORY });
  console.log(`Full CI prerequisite satisfied: ${result.url}`);
}
