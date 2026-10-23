# Continuous integration

[Contributing](../CONTRIBUTING.md#verification) owns local completion and execution limits. This guide owns hosted coverage and evidence; the [CI speed record](archive/CI_SPEED_PLAN.md) retains measurements.

## Pipeline

After a small planning job, static/content checks, unit/DOM tests, the Linux browser build and Windows packaging run independently. Eight duration-balanced browser shards use one worker each; interaction replay consumes the same Linux build. Consumers verify its commit, run, attempt and file hashes. Windows retains its own build, package verification and packaged startup/save/resume/isolation checks.

Unit CI retains every extended simulation, including all ordinary three-creature combinations, through full Vitest discovery. Focused regressions protect complete case registration and the shared journey assertions. [Contributing](../CONTRIBUTING.md#verification) owns the explicit local/CI selection policy; [test maintenance](../tests/README.md#test-organization) locates the scenarios.

Static CI runs types, lint, formatting, boundaries and unused-code checks independently, retaining each failure while reporting all categories. `npm run check:full` remains their sequential entrypoint.

The build job creates an exact test-list plan from complete discovery, assigning the longest estimated cases first to the lightest shard. Estimates in `scripts/ci/browser-durations.json` affect scheduling only; new cases receive a default estimate and the final coverage gate still requires every discovered identity exactly once. Each successful gate exports refreshed estimates in `browser-review`; copy its `ci/browser-durations.json` to the checked-in estimate file when refreshing the baseline. Complete local production-browser reports can also refresh scheduling estimates; they do not establish hosted CI wall time. Renames and new tests must never be omitted for missing timing history.

CI installs with the pinned npm version and lockfile, omitting non-gating audit/funding requests under a three-minute deadline. `package.json` approves install scripts per version; `.npmrc` rejects unreviewed scripts. `npm run security:audit` retains all advisories and fails on new advisories or expired exceptions. The sole temporary exception is build-only `sprintf-js` denial of service GHSA-hp3w-g68c-fv3c, expiring November 21, 2026; no player format strings reach electron-builder's download-proxy logger.

## Required gate and reruns

The final `verify` job runs despite upstream failure while allowing workflow cancellation. It requires:

- Every upstream job and shard, unit totals matching their recorded passing assertions and a complete seeded interaction trace with valid actions and checkpoint hashes for every step
- Every discovered production browser identity exactly once; only the named development-preview case is intentionally excluded
- No `.only`, unexpected skips, retries, duplicates, missing cases or interrupted suites; the five-failure cap applies per browser shard
- Evidence from this run and commit, with positive attempts no later than the current attempt; unit evidence must match its successful job
- Browser/interaction evidence matching the selected build's SHA-256 inventory; rebuilding different bytes requires rerunning those consumers

Failed jobs may be rerun within the same run and commit, retaining earlier successful jobs. The final manifest records contributing attempts. Missing evidence fails the gate. See [GitHub rerun semantics](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).

Branch pushes with an open PR defer to PR verification; main pushes, tags and fork PRs retain their gates. Duplicate suppression may yield a successful workflow with verification skipped, so release qualification requires the exact commit's successful final `verify` job. Superseded automatic branch runs are cancelled; manual benchmarks remain independent.

## Reports and scheduling

CI retains unit JSON, browser blob/JSON/HTML reports, player notes and Windows output for seven days. `browser-review` contains the merged report; `browser-shard-N` retains raw blob attachments. JSON shares the HTML report's `browser-html/data/` attachments instead of duplicating `test-results/`. Collection and merging run on failure where the runner remains available; missing reports never substitute a passing summary.

Complete discovery assigns longest estimated browser cases first to the lightest shard. [Duration estimates](../scripts/ci/browser-durations.json) affect scheduling only; new cases receive a default weight and remain required. Successful gates export refreshed `ci/browser-durations.json` in `browser-review` for copying back to the checked-in baseline.

Manual runs support one, four or eight shards and a `browser_runtime` comparison between normal headless-shell installation and the official lockfile-matched Playwright container. Include initialization costs before changing the default. Headed local review needs full Chromium.

Read completed-run timing with `node scripts/ci/ci-timings.mjs <run-id> [attempt]`, using authenticated GitHub CLI. Timing from inside the final job remains provisional until it finishes. CI checks bundle allowance after the existing production build rather than building twice.

`npm run verify:full` retains sequential full coverage under the local execution policy. Exact-commit CI, [rendered acceptance](UI.md#required-review) and [release qualification](RELEASE.md) are separate outcomes.
