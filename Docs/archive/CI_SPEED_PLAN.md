# CI speed improvement plan

Reduce full verification time while retaining every required check, player journey and rendered evidence surface. Start with eight browser shards on standard GitHub runners and concurrent verification jobs. Aim first for complete results in 2–3 minutes excluding runner queue time; treat a one-minute result as a stretch goal requiring measured improvements to setup, long individual tests and Windows packaging.

The workflow now implements these stages, with the current execution policy in [Contributing](../../CONTRIBUTING.md#verification). Full execution and performance comparisons belong in hosted CI. The rollout evidence below distinguishes measurements from targets.

## Baseline and success measures

The [successful October 21 run](https://github.com/Talyen/Fauna/actions/runs/39558496561) took 10m41s in Linux verification, including about nine minutes for browser tests on one worker and 30 seconds for unit tests. Windows completed in 1m40s. A [later failed run](https://github.com/Talyen/Fauna/actions/runs/39698392213) completed 104 browser cases in 4.8 minutes and unit tests in 51 seconds. These runs have different commits and coverage; they do not establish an optimization ratio.

Before restructuring, capture a successful baseline on the implementation's parent commit. Compare the baseline and candidate on equivalent coverage, recording test identities and skip reasons as well as counts. Report:

- Commit, workflow attempt, runner image, dependency versions and cache state
- Push-to-result time, queue time and job execution time separately
- Checkout, install, build, artifact transfer, test and report-merge durations
- Slowest tests, slowest shard, shard imbalance, failures and retries
- Total runner minutes alongside elapsed time, even when minutes are free

Use at least three successful runs per configuration for the initial comparison; retain failures when assessing reliability. Measure normal median performance first, then accumulate enough runs to assess tail latency. A discovery-only check establishes distribution, not runtime or visual acceptance.

## Proposed job structure

| Job                | Work                                                                                                   | Dependencies  |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ------------- |
| Static and content | Release version, full static checks, documentation contracts, content audit, player notes              | None          |
| Unit               | Complete unit and DOM suites with JSON results                                                         | None          |
| Browser build      | Production build, output assets, bundle allowance and bundled assets checks; upload exact build        | None          |
| Browser shards 1–8 | Full browser suite distributed across eight jobs; one worker per job                                   | Browser build |
| Interaction replay | Existing seeded interaction trace against the exact build                                              | Browser build |
| Windows            | Existing Windows build, package verification, tagged identity and packaged desktop smoke               | None          |
| Results            | Merge browser reports, summarize all results, verify completeness and provide the stable required gate | All jobs      |

Keep Linux Electron downloads disabled. Windows retains its platform-specific build and packaged smoke. Share the Linux build only among Linux browser consumers; do not substitute it for Windows package evidence. Include the evaluated commit and run attempt with build metadata, and consume artifacts from this run only.

Start the independent jobs immediately. Do not make browser execution wait for unit or static results. Keep named steps so timing and failures remain visible; retain the complete verification command for its documented use while CI invokes its constituent checks without duplication.

## Browser distribution and isolation

Use Playwright's built-in sharding with test-level parallel eligibility and one worker per runner. This distributes individual cases from large files instead of making one file the slowest shard. Follow the official [sharding](https://playwright.dev/docs/test-sharding) and [CI guidance](https://playwright.dev/docs/ci).

Before enabling it, inspect module state, fixtures, hooks, saves, ports and evidence paths. Each case must have an independent browser context and explicitly seeded state. Give screenshots and reports unique test and shard paths; use Playwright test output paths where possible. Keep real ordering dependencies serial or restructure their setup without changing their assertions. Never erase player saves to obtain isolation.

Start with eight shards and matrix fail-fast disabled so one failure does not cancel other evidence collection. Preserve the existing five-failure cap per Playwright process, documenting that it becomes per shard. Green runs must execute all eligible cases. Add a suite timeout below the job timeout so Playwright can flush reports before the runner terminates it. Choose timeout values from measured runtime with generous failure headroom.

Compare four and eight shards before choosing the default. Increase beyond eight only if measured gains outweigh queue pressure and repeated setup. Keep one worker per shard until a separate benchmark establishes that more workers preserve reliability and rendered evidence quality.

## Reports and the required gate

Upload a uniquely named blob report and rendered diagnostics from each shard even on test failure. Merge reports using Playwright's supported merge command, then produce the existing human-readable failure summary and JSON output. Preserve screenshots, trace paths and test titles through merging. Merge once after all shards finish.

Run the final gate even when dependencies fail, using `!cancelled()` so superseded workflows can stop. GitHub documents that [job-level `always()` can resist cancellation](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows). Require every expected job and shard to succeed; missing jobs, missing reports, interrupted suites, unexpected skips and incomplete interaction traces must fail it. Report generation must never convert a failed test command into success. Validate both job outcomes and expected discovered test identities so silently omitted shards cannot pass.

Keep a stable required-check name and update branch protection deliberately during rollout. Before removing the old required job, verify the replacement blocks a merge on a failed shard and a failed Windows job. Retain seven-day browser diagnostics initially, measure artifact size, and avoid uploading duplicate build or dependency trees. Windows artifact retention should also be explicit.

## Setup, caching and workflow hygiene

- Keep the existing npm download cache and deterministic installs with the lockfile. Do not share installed dependency directories across operating systems or restore test results as evidence for a new commit
- Build once for Linux browser consumers. Measure compressed transfer time and artifact size; choose compression suitable for the already compressed artwork
- Keep Chromium installation as the initial baseline. Evaluate an official Playwright container only after measuring image-pull cost and confirming its version matches the installed Playwright package. Do not assume browser caching is faster than installation
- Use shallow checkout for jobs that do not need history. Preserve sufficient history and tags for player-note generation and release identity
- Avoid duplicate push and pull-request runs for the same branch when a PR is open, while preserving main pushes, tags and fork PR verification. Retain cancellation of superseded branch runs; tagged verification must not be accidentally cancelled by another tag
- Keep read-only workflow permissions and no secrets in untrusted PR verification. Do not introduce privileged PR triggers to recover cache access
- Pin external actions to reviewed commit SHAs during the workflow edit and use automated updates to maintain them

Standard hosted runner minutes for a public repository are free; larger runners are paid. GitHub currently documents 20 concurrent standard jobs on Free, shared across the owner's repositories. Eight shards and the proposed supporting jobs fit within that limit for one run, but simultaneous runs can queue. Confirm the owner's actual plan and available concurrency during implementation. See [billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [limits](https://docs.github.com/en/actions/reference/limits) and [cache guidance](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).

## Test improvements after parallelization

Optimize the measured slowest tests before adding runners. Preserve one full starter-to-victory expedition, required viewport and input coverage, and distinct visual states. Use bounded seeded scenarios for focused regressions. Replace arbitrary transition waits with observable readiness, retaining waits that verify held input, autoplay or actual audio timing. Keep exhaustive engine rules at the unit layer and ownership/focus behavior at the DOM layer where those layers can detect the same defect.

Do not reduce screenshots, assertions, timeouts or coverage solely to achieve the speed target. Any transfer between test layers needs a concrete explanation of the failure still detected. Do not add retries to conceal instability introduced by parallelization. If retries become necessary, report first-attempt failures and treat retry success as a reliability signal requiring investigation.

Defer path-based omission of gameplay, browser and Windows gates. First make the complete suite fast and trustworthy. A later documentation-only route can be considered with explicit dependency rules and a final gate that distinguishes intentional omissions from missing evidence.

## Rollout and acceptance

1. Capture the comparable baseline and audit parallel isolation and artifact paths
2. Separate named stages and independent jobs; retain coverage and verify report handling before sharding
3. Enable four shards, then benchmark eight on the same candidate coverage. Inspect merged screenshots and failure diagnostics
4. Exercise deliberate failures through isolated CI fixtures or a temporary validation branch: failed test, failed static check, failed Windows job, absent report and interrupted shard. Confirm the required gate rejects each outcome
5. Run complete hosted verification on the final candidate, inspect browser evidence, and record the measured improvement and remaining bottleneck
6. Update [Contributing](../../CONTRIBUTING.md#verification), the [script map](../../scripts/README.md) and required-check configuration together. Remove temporary failure probes and duplicate validation runs before handoff

Accept the change when all prior required coverage is represented, every gate passes on the exact candidate commit, merged evidence remains usable, failure propagation is demonstrated and repeated runs show improved elapsed time without additional instability. Keep Windows, browser simulation, physical controller, Steam client and Steam Deck evidence boundaries distinct.

If isolation or reporting regresses, restore one browser job while retaining independent jobs and useful timing instrumentation. Preserve the same final required-check name. Record actual timing against the baseline; do not describe 10× as achieved until equivalent complete runs demonstrate it.

## Rollout measurements and verification

On October 21, 2026, three four-shard runs and three eight-shard runs passed on the same benchmark commit, `1eea2970b6e0d427ca707041f9abd4f13cb058c0`. All accounted for the same 104 browser cases: 103 passed and the one documented development-preview case skipped. The gate additionally required static/content checks, the complete unit suite, interaction replay and Windows package/smoke verification. These measurements precede the subsequent Sternshell, Neradora, Stillara, Cadenza and room-scaling integrations; they establish the shard choice for that frozen coverage, not a performance guarantee for later content.

| Shards | Complete workflow after first job started                                                                                                                                                               | Median | Median longest browser shard | Median total runner time |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------- | ------------------------ |
| Four   | [4m49s](https://github.com/Talyen/Fauna/actions/runs/39708118398), [4m27s](https://github.com/Talyen/Fauna/actions/runs/39708605868), [4m00s](https://github.com/Talyen/Fauna/actions/runs/39709083335) | 4m27s  | 1m40s                        | 15m13s                   |
| Eight  | [3m48s](https://github.com/Talyen/Fauna/actions/runs/39708002707), [3m29s](https://github.com/Talyen/Fauna/actions/runs/39708608258), [4m13s](https://github.com/Talyen/Fauna/actions/runs/39709085828) | 3m48s  | 1m08s                        | 18m51s                   |

Initial dispatch delays were 2–4 seconds. The workflow durations above include later job scheduling, dependency waits, installs, builds, report merging and artifact transfer; GitHub does not expose enough information to subtract all individual runner queue waits. The eight-shard median was about 15% faster than four, using about 24% more total runner time. Eight remains the default on the free standard public-repository runners. These samples are too small to establish tail latency or a long-term flake rate.

The [earlier successful single-shard run](https://github.com/Talyen/Fauna/actions/runs/39707433479), on `63ef14f`, took 9m14s after the first job started, including 5m14s for browser execution. Its player coverage was also 104 cases, but it preceded checkout and gate hardening, so it is a rollout observation rather than an identical-commit comparison. The [attempt to run unchanged main](https://github.com/Talyen/Fauna/actions/runs/39706354042) failed on an existing unused import before tests; it supplies no successful baseline. The 2–3 minute initial target and 10× stretch goal have not been demonstrated.

The hardened eight-shard report was downloaded and checked: all 231 screenshot attachments had relative paths and existing files. Rendered sample screenshots were inspected. Permanent executable gate fixtures run in the hosted unit job and reject failed static/browser/Windows outcomes, absent reports, interrupted cases, duplicate or missing cases, unexpected skips, stale attempts and modified downloaded builds. This validates the gate without retaining deliberately failing workflow branches or reducing player regression coverage.

The final `verify` check name remains stable. No branch protection or rulesets were configured when inspected, so there was no existing required-check setting to migrate. GitHub merge enforcement would require a separate repository-policy change compatible with the local integration workflow.

Current-main integration required refreshing catalog expectations, creature-specific starter fixtures and per-card counters introduced by the concurrent content work. Retaliation tests now compare damage against the authored encounter's starting Health. The full expedition retains its 400-command bound and final victory/team/roster assertions, using a shared known seed for the current content. It uses the game's current battle-choice policy, and its browser driver reuses the already observed committed state within each iteration, avoiding a redundant save-readiness check. The correctness test that constructs and replays three performance journeys has a scoped 15-second deadline after repeated hosted timeouts at the default five seconds; its journey and checkpoint assertions are retained. The multi-journey save/resume replay test uses the same scoped deadline. No gameplay source was changed by the CI work.

## Browser and UI suite optimization observations

The subsequent suite work preserves the full expedition and the existing viewport, input, catalog, rank-page and screenshot coverage. Collection/rank browsing, menu layout and battle-hand layout now run as separate seeded cases. A duration plan assigns every discovered case exactly once using checked-in estimates; unknown cases receive a default weight. The gate exports fresh measured weights for future updates. First-page seeding no longer boots the application twice, and its regression checks that preferences survive setup and later saves survive reloads.

The [first successful candidate](https://github.com/Talyen/Fauna/actions/runs/39729601659), `d3e018d`, passed 122 browser cases with the one documented development-preview skip. Splitting six tours added twelve cases and the seeding regression added one; the [preceding comparison run](https://github.com/Talyen/Fauna/actions/runs/39728079266), `64f0788`, had 109 passing cases and that same skip. Both reports contain exactly the same 257 screenshot names. Every candidate attachment resolved after download, and enlarged-text Collection, Settings and battle-hand samples were inspected.

The merged review artifact fell from 203,671,946 to 102,719,589 bytes, about 50%, by making portable JSON refer to the HTML report's existing content-addressed files. Shard artifacts retain screenshot and trace attachments inside their blob reports instead of uploading another copy of the raw output directory. Missing or mismatched merged resources still fail portability validation. This changes storage, not screenshot selection.

A normal-install and corrected-container comparison used the same `e69cafd` commit, coverage, weights and eight-shard configuration:

| Runtime                                                                                          | Complete workflow after first job started | Longest browser execution step | Median complete browser job | Total runner time |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------: | -----------------------------: | --------------------------: | ----------------: |
| [Normal installation](https://github.com/Talyen/Fauna/actions/runs/39730438438)                  |                                     3m46s |                            53s |                       91.5s |            21m12s |
| [Version-matched Playwright container](https://github.com/Talyen/Fauna/actions/runs/39730846563) |                                     3m48s |                            55s |                      106.5s |            22m37s |

Container initialization took 25–38 seconds per browser job; normal Chromium installation took 17–25 seconds. The container remains a manual benchmark option, with the exact Playwright version read from the lockfile. Normal installation remains the default. An [earlier container probe](https://github.com/Talyen/Fauna/actions/runs/39730040812) failed before browser startup because Git rejected mounted-checkout ownership; the corrected path trusts only the runner workspace. That failed probe is excluded from the runtime comparison.

The final installation command additionally uses Playwright's `--only-shell` option. These browser and interaction jobs already launch the headless shell without a browser channel, so the headed Chromium download is unnecessary. This final download reduction is not included in the runtime pair above and requires its own final-commit CI result.

A focused local single-worker comparison of the exhaustive talent-browsing test measured 2.96 seconds for the original document-wide queries and 2.34 seconds for scoped queries with a reused user-event session. Accessible-name, pagination, purchase and requirement assertions remain in place. This is one local comparison, not a hosted-suite speedup claim.

These samples demonstrate complete coverage and smaller artifacts. They do not establish a stable total-workflow speedup: the earlier comparison workflow finished in 3m43s, versus 4m00s for the first candidate and 3m46s for the measured-weight candidate. Runner and non-browser timings varied substantially. The container comparison has only one successful run per configuration, and these observations do not establish tail latency or a long-term flake rate. Browser evidence covers simulation; packaged Windows smoke remains separate from physical-controller, Steam-client and Steam-Deck qualification.
