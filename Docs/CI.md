# Continuous integration

[Contributing](../CONTRIBUTING.md#verification) owns local completion and execution limits. This guide owns hosted coverage and evidence; the [CI speed record](archive/CI_SPEED_PLAN.md) retains measurements.

## Pipeline

After a small planning job, static/content checks, unit/DOM tests, sixteen exhaustive lineup workers, the Linux browser build and Windows packaging run independently. Eight duration-balanced browser shards use one worker each; interaction replay consumes the same Linux build. Consumers verify its commit, run, attempt and file hashes. Windows retains its own build, package verification and packaged startup/save/resume/isolation checks.

Unit CI discovers every unit, DOM and exhaustive case without filtering. Regular contracts run in the unit job; sixteen lineup jobs partition the complete ordinary three-creature matrix by stable scenario index, preserving seeds and every intermediate save check. The final gate requires the exact discovered cases across all seventeen reports, including the multiplicity of parameterized tests with shared titles. Missing, extra, duplicate, failed or skipped results fail the gate; every lineup artifact carries its shard, commit, run and attempt. An ordinary `test:full` command without the internal `FAUNA_LINEUP_SHARD` selection still runs the entire matrix. Focused regressions protect complete case registration and the shared journey assertions. [Contributing](../CONTRIBUTING.md#verification) owns the explicit local/CI selection policy; [test maintenance](../tests/README.md#test-organization) locates the scenarios.

Static CI runs types, lint, formatting, boundaries and unused-code checks independently, retaining each failure while reporting all categories. `npm run check:full` remains their sequential entrypoint.

CI installs with the pinned npm version and lockfile, omitting non-gating audit/funding requests under a three-minute deadline. `package.json` approves install scripts per version; `.npmrc` rejects unreviewed scripts. `npm run security:audit` retains all advisories and fails on new advisories or expired exceptions. The sole temporary exception is build-only `sprintf-js` denial of service GHSA-hp3w-g68c-fv3c, expiring November 21, 2026; no player format strings reach electron-builder's download-proxy logger.

## Required gate and reruns

The final `verify` job runs despite upstream failure while allowing workflow cancellation. It requires:

- Every upstream job and shard, unit totals matching their recorded passing assertions, every discovered unit case accounted for, and a complete seeded interaction trace with valid actions and checkpoint hashes for every step
- Every discovered production browser identity exactly once; only the named development-preview case is intentionally excluded
- No `.only`, unexpected skips, retries, duplicates, missing cases or interrupted suites; the five-failure cap applies per browser shard
- Evidence from this run and commit, with positive attempts no later than the current attempt; unit evidence must match its successful job
- Browser/interaction evidence matching the selected build's SHA-256 inventory; rebuilding different bytes requires rerunning those consumers

Failed jobs may be rerun within the same run and commit, retaining earlier successful jobs. The final manifest records contributing attempts. Missing evidence fails the gate. See [GitHub rerun semantics](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).

Branch pushes with an open PR defer to PR verification; main pushes, tags and fork PRs retain their gates. Duplicate suppression may yield a successful workflow with verification skipped, so release qualification requires the exact commit's successful final `verify` job. Superseded automatic branch runs are cancelled; manual benchmarks remain independent.

## Reports and scheduling

CI retains unit JSON, browser blob/JSON/HTML reports, player notes and Windows output for seven days. `unit-results` contains regular contracts and unfiltered discovery; `lineup-results-N` contains each exhaustive shard. `unit-review` contains the coverage-checked combined unit report and shard durations. Unit summaries show the ten slowest files and tests; the final gate reports each group's duration and the spread between fastest and slowest lineup workers. File timings measure each shard separately rather than adding concurrent times. `browser-review` contains the merged browser report; `browser-shard-N` retains raw blob attachments. JSON shares the HTML report's `browser-html/data/` attachments instead of duplicating `test-results/`. Collection and merging run on failure where the runner remains available; missing reports never substitute a passing summary.

The build job uses complete discovery to assign the longest estimated browser cases first to the lightest shard. [Duration estimates](../scripts/ci/browser-durations.json) affect scheduling only; new cases receive a default weight and remain required. Successful gates export refreshed `ci/browser-durations.json` in `browser-review` for copying back to the checked-in baseline. Complete local production-browser reports can also refresh scheduling estimates; they do not establish hosted CI wall time. Renames and new tests remain required without timing history.

Browser and interaction jobs default to the official lockfile-matched Playwright container to avoid per-job Chromium installation variability. Manual runs retain one, four or eight browser shards and a `browser_runtime` comparison with normal headless-shell installation. Compare the same commit and include container initialization and runner costs when measuring gains. Headed local review needs full Chromium.

Manual runs also accept `browser_workers=1` or `2` per browser job, capped at eight total workers. Automatic runs retain eight jobs with one worker each. To compare setup overhead at the same total concurrency, dispatch the same published commit with `shards=8`, `browser_workers=1`, then `shards=4`, `browser_workers=2`, using `browser_runtime=container` for both. Keep the ref fixed through both runs. Compare completed workflow elapsed time, summed runner time, per-shard test time and failures before changing the automatic default; repeat matched pairs if the difference is close. Worker counts come from the executed Playwright configuration and must match the requested count at the final coverage gate. Interaction replay remains one worker.

The [October 23 matched comparison](task-evidence/2026-10-23-test-suite-followup.md#completed-matched-comparison) passed in both configurations. Four two-worker jobs used 42.2% less browser runner time, but the longest browser test step rose from 90 to 128 seconds and the workflow from 306 to 364 seconds. Eight single-worker jobs remain the automatic default for faster feedback; the four-job option trades latency for lower runner use.

The CLI career/replay regression retains stage timings in `unit-results` at `ci/playthrough-timings.json`. These distinguish Vite setup, source identity, module loading, fixture setup and journey execution, with awaited journal append time reported separately as overlapping work. Compare the same source identity and scenario; these observations never replace full replay assertions or establish browser speed.

Read completed-run timing with `node scripts/ci/ci-timings.mjs <run-id> [attempt]`, using authenticated GitHub CLI. Timing from inside the final job remains provisional until it finishes. CI checks bundle allowance after the existing production build rather than building twice.

`npm run verify:full` retains sequential full coverage in CI; heavy local use requires the explicit opt-in under the [execution policy](../CONTRIBUTING.md#execution-and-evidence). No additional CI suites are needed for the lightweight local gate: this pipeline already runs all compiler environments, complete unit/DOM/exhaustive discovery, builds, browser coverage and Windows packaging. Local integration does not launch or imply a CI run; running an unpushed task commit requires separately authorized publication before GitHub can see it. Exact-commit CI, [rendered acceptance](UI.md#required-review) and [release qualification](RELEASE.md) are separate outcomes.
