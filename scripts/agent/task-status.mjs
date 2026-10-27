import { existsSync, lstatSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dependenciesAvailable, matchingDependencies } from "../dependencies.mjs";
import { git, worktrees } from "../lib/git.mjs";
import { taskBase, taskPaths } from "../lib/task-selection.mjs";
import { taskIntent } from "../lib/task-intent.mjs";
import { readTaskEvidence, recordVisualReview, visualReviewStatus } from "../lib/task-evidence.mjs";

/** Read-only orientation; local receipts do not replace the protected integration gate. */
export function taskStatus(root) {
  const branch = git(root, ["branch", "--show-current"]).trim() || "(detached)";
  const commit = git(root, ["rev-parse", "HEAD"]).trim();
  const base = taskBase(root);
  const changes = taskPaths(root, { base });
  const dirty = Boolean(git(root, ["status", "--porcelain", "--untracked-files=all"]));
  const modules = path.join(root, "node_modules");
  const linked = lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink();
  const main = worktrees(root).find((tree) => tree.branch === "refs/heads/main")?.path;
  const dependencies =
    dependenciesAvailable(root) &&
    (!linked ||
      (main &&
        existsSync(modules) &&
        realpathSync(modules) === realpathSync(path.join(main, "node_modules")) &&
        matchingDependencies(root, main)));
  let sparse = "";
  try {
    sparse = git(root, ["config", "--get", "core.sparseCheckout"]);
  } catch {
    // An unset Git option means a full checkout.
  }
  let evidence = {};
  try {
    evidence = readTaskEvidence(root);
  } catch {
    // Missing or unreadable source is never evidence of a pass.
  }
  return {
    root,
    branch,
    commit,
    base,
    changes,
    dirty,
    dependencies: Boolean(dependencies),
    sparse: sparse.trim() === "true",
    main: main ?? null,
    mainDirty: main ? Boolean(git(main, ["status", "--porcelain", "--untracked-files=all"])) : null,
    recordedTests: taskIntent(root).tests,
    evidence,
    visualReview: visualReviewStatus(root, evidence.visual),
  };
}

export function hostedStatus(root, commit, runner = spawnSync) {
  const run = (args) => {
    const result = runner("gh", args, { cwd: root, encoding: "utf8", timeout: 10_000 });
    if (result.error || result.status !== 0) throw new Error("GitHub status unavailable");
    return JSON.parse(result.stdout);
  };
  try {
    const runs = run([
      "run",
      "list",
      "--workflow",
      "ci.yml",
      "--commit",
      commit,
      "--limit",
      "20",
      "--json",
      "databaseId,headSha,status,conclusion,url",
    ]);
    const latest = runs.find((entry) => entry.headSha === commit);
    if (!latest)
      return "No hosted workflow found for this commit; it may be unpublished, unavailable or not yet scheduled. Publishing a task branch requires explicit authorization; see Docs/CI.md#hosted-task-verification.";
    const details = run([
      "run",
      "view",
      String(latest.databaseId),
      "--json",
      "headSha,status,conclusion,jobs,url",
    ]);
    if (details.headSha !== commit) return "Hosted run identity did not match; no CI result established.";
    const verify = details.jobs?.find((job) => job.name === "verify");
    return `Latest exact-commit run: ${details.status}/${details.conclusion || "pending"}; final verify job: ${verify ? `${verify.status}/${verify.conclusion || "pending"}` : "not found"}; ${details.url}`;
  } catch {
    return "Hosted status unavailable; no CI result established.";
  }
}

export function describeTask(status, ci) {
  const lines = [
    `Checkout: ${status.root} (${status.branch})`,
    `Commit: ${status.commit}${status.dirty ? " (working changes are not in this commit)" : ""}`,
    `Selection base: ${status.base}; ${status.changes.length} changed file(s)`,
    ...status.changes.map((file) => `  ${file}`),
    `Dependencies: ${status.dependencies ? "available" : "unavailable or mismatched; run npm run deps"}`,
    status.sparse
      ? "Source assets: sparse checkout; for art/source authoring run git sparse-checkout disable before preparation"
      : "Source assets: checkout is not sparse; asset readiness has not been checked",
    `Recorded suites (intent only; not evidence of execution): ${status.recordedTests.join(", ") || "none"}`,
    `Main: ${status.main ? (status.mainDirty ? "dirty; integration will preserve it and stop" : "clean at this moment; integration rechecks under lock") : "not found; integration unavailable"}`,
    `Local gate: ${status.evidence?.gate === "passed" ? "passed for current source (integration reruns it)" : status.changes.length ? "unknown; run npm run verify:changed" : "unknown; no changed files selected"}`,
    `Focused regression: ${typeof status.evidence?.regression === "string" ? `command exited 0 for current source: ${status.evidence.regression}; check test count in output` : "unknown; run one exact suite when useful"}`,
    `Rendered review: ${status.visualReview ? `manually recorded for current source: ${status.visualReview}; see handoff for inspection and interactions` : "unknown; inspect and record required UI evidence (Docs/UI.md#required-review)"}`,
    `Hosted CI: ${ci ?? "not checked; run npm run task:status -- --ci for the exact commit"}${status.dirty ? " Working changes are not covered by this commit." : ""}`,
    status.branch === "main"
      ? "Next: create an isolated task with npm run worktree -- <task-name>."
      : "Next: inspect npm run review:diff; run one focused regression if useful; commit and run npm run finish. Visual changes also require Docs/UI.md#required-review.",
  ];
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let ci = false;
  let visual;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--ci" && !ci) ci = true;
    else if (
      args[index] === "--record-visual" &&
      !visual &&
      args[index + 1] &&
      !args[index + 1].startsWith("--")
    )
      visual = args[++index];
    else throw new Error("Usage: npm run task:status -- [--ci] [--record-visual <capture-evidence.json>]");
  }
  if (visual) recordVisualReview(process.cwd(), visual);
  const status = taskStatus(process.cwd());
  console.log(describeTask(status, ci ? hostedStatus(status.root, status.commit) : undefined));
}
