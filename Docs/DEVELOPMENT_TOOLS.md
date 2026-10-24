# Development tools

[Contributing](../CONTRIBUTING.md) owns everyday checks and resource limits; the [script map](../scripts/README.md) locates implementations. This is the opt-in workflow reference.

- [Preview and capture](#task-checkouts-and-previews), [focused interactions](#focused-routes-and-seeded-interactions)
- [Content audit](#content-checks), [media and listening](#prepared-media-and-sound-desk)
- [Headless journeys](#headless-journeys), [paired balance](#paired-balance-reports), [findings](#ranked-balance-findings)
- [Performance](#reproducible-performance-captures), [native/reachable scenarios](#native-and-reachable-performance-scenarios), [compiler trial](#periodic-performance-and-compiler-trial)
- [Diagnostics](#local-diagnostics), [task selection](#task-selection-and-diagnostics), [review/lookup](#review-and-owner-lookup), [platform checks](#architecture-and-packaged-platform-checks)

Reports remain under ignored `reports/`; retain their source/checkpoint identities and actual completion status. Failed/incomplete captures are diagnostics, never accepted evidence. Browser automation simulates input; [Release](RELEASE.md) owns native, package and hardware qualification. [UI review](UI.md#required-review) owns rendered acceptance.

Command examples describe tool interfaces, not permission to run heavy work locally. Production builds, browser/desktop suites, balance simulations, performance captures and every diagnostic mode are CI-owned; local execution requires the explicit user request described in [Contributing](../CONTRIBUTING.md#execution-and-evidence). The launcher also guards read-only subcommands of those entrypoints, including route `--list`, `balance:compare -- compare` and `perf:compare`. Task-owned focused visual preview/capture remains authorized under UI review. For one exact local regression, use `npm test -- <suite>` rather than diagnostic mode; `balance:findings` can analyze an existing report without running simulations.

## Task checkouts and previews

Start a browser preview, then capture matching before/after states:

```sh
npm run preview:task -- --browser --scenario battle
npm run capture:task -- --scenario battle --label before
npm run capture:task -- --scenario battle --label after
```

| Choice                                | Behavior                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser defaults                      | 1280×720, 125% text, reduced motion; headed preview needs full Playwright Chromium, capture uses the headless runtime                                                                       |
| Scenario                              | Select a name from [review-scenarios.mjs](../scripts/dev/review-scenarios.mjs); no scenario opens Main menu; add new states there using validated [game fixtures](../tests/support/game.ts) |
| Layout capture (default)              | 1280×720 at 125% text and 1920×1080 at default text                                                                                                                                         |
| `--tier small` / `--tier interaction` | Minimum viewport with enlarged text; [UI review](UI.md#required-review) defines when each tier applies                                                                                      |
| Custom conditions                     | For example, `--viewport 1920x1080 --text-scale 1`; capture adds one custom-condition frame and cannot combine these options with an explicit tier                                          |
| `--desktop`                           | Isolated Electron profile, inherited Node/performance modes cleared and real Steam disabled; browser seeding options do not apply                                                           |
| No browser/desktop flag               | Start only the owned server                                                                                                                                                                 |

Scenarios use fresh browser contexts; reload preserves commands committed after seeding. Capture owns and closes its quiet preview, waits for finite transitions/artwork, checks layout and rejects browser errors. It writes a unique directory under `reports/` containing the validated checkpoint/hash, render-input identity, conditions, frame paths and completion status. Preparation, browser or layout failures retain errors and any capturable diagnostic frames with `complete: false`.

Compare matching checkpoint hashes and conditions, inspect the frames, and exercise changed interactions separately. Capture cannot approve appearance or test an interaction on its own. The older [Merchant study capture](../design/visual-quality/capture.mjs) covers additional purchase/inspection states.

Session records contain identity, port, checkout and owner PID. Ctrl+C closes owned handles; an old PID record never authorizes terminating that process later. Previews, including `dev:desktop`, are quiet; use `npm run dev` for audible listening.

Reuse [browser helpers](../tests/README.md#browser-and-ui-coverage) for seeding, pagination/resize, focus, layout and settled screenshots. Recovery scenarios live in `tests/integration/recovery/` and [scroll-free journeys](../tests/e2e/scroll-free.spec.ts); [UI contracts](UI.md) define their product behavior.

## Focused routes and seeded interactions

`npm run test:e2e:route -- battle --list` lists a named route without launching it. Routes are battle, settings, collection, progression and persistence; remove `--list` to run one. They select fixed files and title filters and accept only `--list`, `--headed` or `--debug`, so a typo cannot silently launch the whole suite. CI still runs every browser test.

After building, `npm run test:interactions -- --seed 42 --steps 24 --family mixed` drives rendered controls in an isolated profile. Navigation, battle and persistence families can also run separately. Reports retain seed, current-format initial checkpoint, source identity, attempted actions and checkpoint hashes under ignored reports. Battle actions are checked against the production dispatcher; menu actions must preserve progression. Reload exercises save/resume. This is bounded seeded coverage, not exhaustive UI exploration.

`npm run test:interactions -- --replay reports/interactions/example/report.json` replays exact actions and hashes, rejecting changed source identity. Add `--shrink true` on failure for deletion-based reduction, with a fresh context for each candidate and a budget of 40 attempts / 30 seconds. Inapplicable commands and different failure signatures cannot replace the original failure. The original trace remains intact; `minimal.json` is a separate replayable candidate. A bounded shrink does not claim global minimality.

## Content checks

`npm run content:audit` reports authored-content errors and warnings by stable ID and field, and writes `reports/content-audit.json`. The pure validator in `src/game/content-validation.ts` also supplies startup validation through the existing `validateContent` export. It checks IDs, owners, supported magnitudes/costs, effect and keyword registration, encounter packs, boss positions, stats, and talent rows/references. Missing player cards for a progression keyword are advisory warnings.

Card descriptions derive from their structured effects. Handwritten traits, boons and talent prose still need focused gameplay tests and review; the validator does not prove arbitrary English describes a resolver correctly. Media checks validate manifest coverage, image geometry, preparation identities and output bytes. CI runs the content audit.

## Prepared media and Sound desk

See [Content and artwork](CONTENT.md#prepared-assets) for manifest authoring, preparation, receipts and source checks. `npm run audio:review` generates ignored review inputs. `npm run audio:review -- --serve` opens an explicitly served local Sound desk on a free port; run it for listening only when requested. It serves only registered prepared media and the review page.

The desk compares current assignments with any prepared candidate of the same kind, offers original or level-matched playback, and saves local choices against the manifest identity. Playback stops on another audition, selection changes, page hiding, or Stop. Export choices explicitly; auditioning and choosing never install replacements. Exported source/output hashes identify the exact recording. Adopt a choice by updating the manifest and preparing again. Listening and device/mix acceptance remain separate from successful metadata checks.

## Headless journeys

```sh
npm run balance:playthrough -- --seed 42 --runs 2 --starter emberback --policy heuristic
npm run balance:playthrough -- --replay reports/playthrough/journey.json --out reports/replay
npm run balance:playthrough -- --seed 42 --runs 2 --compare reports/baseline/journey.json --out reports/comparison
```

The opt-in runner uses production application commands, current save validation, serialized in-memory writes and periodic save/resume. Policy randomness is separate from gameplay randomness. The heuristic attacks vulnerable enemies, restores injured allies, buys available talents and replaces fallen deployed creatures with healthy reserves. Random policy randomizes visible legal card choices; both policies use only the player-visible offer and creature state. Neither reads enemy target intentions or future offers. Recruitment grows the roster and chooses an existing individual to release at capacity; those choices do not imply a human-optimal team.

| Option             | Meaning                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--save path`      | Begin from a current-format checkpoint; otherwise start without earned progression; subsequent journeys retain earned progress                                |
| `--seed`, `--runs` | Scenario seed and 1–20 journeys                                                                                                                               |
| `--starter`        | Preference among actual offers, restricted to `FIRST_RUN_STARTERS` even with a save; if absent from offers, the policy chooses another using its separate RNG |
| `--policy`         | `heuristic` or `random`; neither reads hidden intentions or future offers                                                                                     |
| `--out`            | Directory under ignored `reports/`; path components cannot be symlinks                                                                                        |

| Output          | Contents and validity                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `journey.json`  | Initial checkpoint, every attempted command/acceptance result and canonical validated state/RNG checkpoints                                   |
| `summary.json`  | Completion, outcomes, encounter reached, actions, battle lengths/lineups, first/second point milestones, roster and retained Gold/XP          |
| Attempt journal | Append before each command and after save acknowledgement; interrupted runs retain an incomplete summary and journal path                     |
| Replay          | Matching code/content identity and exact checkpoints required; any divergence fails                                                           |
| Comparison      | Completed careers with matching initial checkpoints/settings; changed code identity is explicit; changed save formats require fresh baselines |

Each run has a 60-second external watchdog, 5,000-action budget and 100-turn-per-battle limit. Cancellation/watchdog stops the owned worker and waits for exit; it fails even if that worker exits zero. Missing, duplicate or unknown options fail before launch. Incomplete runs fail rather than becoming wins or defeats. CI runs focused replay tests; larger sweeps need a deliberate hosted run or explicit heavy-local authorization. These are automated-policy observations, not human win rates or rendered acceptance.

## Paired balance reports

Run identical suites from two code versions in hosted execution, then compare their reports. If heavy local execution is explicitly authorized, choose a bounded subset within its command budget:

```sh
npm run balance:compare -- run --starters emberback --seeds 0,1 --out reports/balance/smoke
npm run balance:compare -- compare reports/balance/before/report.json reports/balance/after/report.json
npm run balance:compare -- replay reports/balance/smoke/case-0.json
```

| Setting             | Contract                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default suite       | Five preferences (Emberback, Prismram, Captoad, Dunefox, Cindernewt) × seeds 0–9, run serially; a fixed benchmark subset, not full starter coverage                               |
| Custom suite        | Up to five distinct preferences and ten distinct seeds                                                                                                                            |
| Each case           | Production heuristic, Auto-end turn on, 5,000 actions, 100 turns per battle, save/resume every 17 actions, 60-second watchdog                                                     |
| Suite deadline      | Internal 15 minutes; explicitly authorized heavy local commands still have the [five-minute limit](../CONTRIBUTING.md#execution-and-evidence) unless a larger budget is requested |
| Interruption        | Stop/wait for the owned worker before another case; preserve incomplete reports rather than counting timeouts as defeats                                                          |
| Species attribution | Record requested `starter` and first accepted `actualStarter`; fallback or unrecorded drafts become coverage watch items, not results for the requested species                   |

More preferences on the same seeds do not establish independent opening matchups. Comparisons require matching settings and initial checkpoint hashes; explicitly identified code/content changes are allowed. `comparison.json` reports paired mean differences and standard errors for wins, turns, remaining roster Health, encounter reached, swaps, retained Gold and XP. Effects within two standard errors are noisy; a single pair cannot estimate uncertainty. These are automated-policy observations.

For a controlled two-arm experiment:

```sh
npm run balance:compare -- experiment --checkpoint reports/checkpoint.json --loadouts reports/loadouts.json --out reports/balance/experiment
```

The JSON defines `baseline` and `treatment`, each with explicit `talents` and `boons` ID arrays. Both retain XP budgets and all other checkpoint fields; invalid IDs, prerequisites or budgets fail. Grants are fixtures, not earned progression. Injecting an active battle does not replay settled opening effects; choose the intended combat checkpoint. Each arm writes command/checkpoint evidence and a paired comparison.

Replay requires matching code identity, checkpoints and complete execution. Balance and playthrough fingerprints cover gameplay/application source and save-format JSON; changing these inputs requires fresh journals. [playthrough.ts](../src/tooling/playthrough.ts) rejects obsolete journal/policy versions. All output stays under ignored `reports/`.

## Ranked balance findings

Balance runs, experiments and comparisons now write ranked `findings.json` and `findings.md` beside their evidence. `npm run balance:findings -- reports/balance/smoke/report.json` reanalyzes an existing suite without running simulations; an optional second argument selects a directory under ignored reports. It also accepts a generated `comparison.json`. No finding changes gameplay or tuning automatically.

Critical findings identify incomplete evidence, including watchdogs and rejected commands; unfinished cases never become defeats. Review findings identify completed careers averaging over 120 turns, no retained keyword XP, starter success spreads of at least 25 percentage points with matching seed sets and an approximate two-standard-error filter, or supported paired shifts. Paired thresholds are 20 percentage points for success, 5 turns, 5 remaining Health, 20 Gold and 5 keyword XP. Either direction can merit review. These are Fauna review heuristics, not Alchemy's encounter targets or release gates.

At least five samples are needed for review-level statistical findings. Extreme 0%/100% success, small samples and noisy paired effects remain watch items; zero observed variance at an extreme is not certainty. Within each severity, findings rank by threshold-relative magnitude and then stable ID, retaining case/journal references. Career success comparisons are observational, with differing recruitment and policy choices; investigate individual matchups before attributing causation. One-checkpoint experiments remain explicitly small samples. No findings does not establish balanced content or a human win rate.

## Reproducible performance captures

The [hitch attribution plan](PERFORMANCE_ATTRIBUTION_PLAN.md) proposes timestamped frame timelines, semantic spans and optional deep traces; those extensions are not implemented yet.

The [October 22 frame pacing investigation](task-evidence/2026-10-22-frame-pacing.md) records
shared layout and animation optimizations, visual parity evidence and remaining device qualification.

For a bounded battle investigation in hosted execution or explicitly authorized heavy local execution, build with `npm run verify:changed -- --diagnostic build`, then run `npm run verify:changed -- --diagnostic performance battle`. Diagnostic mode uses the same execution policy as the capture/replay commands below.

Build once with `npm run build`, then run `npm run perf -- --out reports/performance/baseline`. The three scenarios cover card play/enemy turns, required knockout replacements, and Collection/menu transitions. `--scenario battle`, `swap`, or `menus` selects one. A named fixture explicitly grants three deployed creatures and one reserve; it is validated as a current-format save, not claimed to be earned progression. The driver uses normal controls in fresh browser contexts, an owned production preview on a free port, and muted speaker output.

Each scenario gets one unmeasured warm-up and one measured run at 1280×800 with normal motion and Auto-end turn disabled. Action segments retain 1,200 ms of ordinary transition/feedback time. Reports include frame percentiles, gap counts over 20/33.3/50/100 ms, supported long-task/input timings, and heap/DOM/media observations. Unsupported metrics are null. At least sixty frame gaps and ten frames per completed action segment are required. Stalled actions, missing samples and divergent saves fail the capture.

`npm run perf:replay -- reports/performance/baseline/report.json reports/performance/replay` repeats its exact checkpoint and controls. `npm run perf:compare -- reports/performance/baseline/report.json reports/performance/replay/report.json` writes differences only for compatible environments, fixtures and action/checkpoint hashes. Raw samples, segments, build hashes and replay inputs remain beside the summary. Build hashes cover every emitted renderer and media file, desktop files, package metadata and the save-format JSON. Run captures without competing local workloads; browser timing is observational and does not prove physical controller, GPU presentation, Proton or Deck performance. Capture and replay do not rebuild.

## Native and reachable performance scenarios

`npm run perf -- --electron --scenario battle` uses the production renderer through Electron's sandboxed preload and file saves in a fresh temporary profile. Speaker output is muted without disabling the audio graph. Native captures use a frameless 1280×800 content window so desktop title bars cannot clamp the viewport. This harness setting is recorded and does not alter ordinary launch behavior. Set `FAUNA_ELECTRON_EXECUTABLE` only to explicitly select an installed runtime; the report records its actual version. `npm run perf -- --electron --cold` captures new-process launch to visible Continue, followed by an idle frame sample. Cold startup uses default preferences and issues no gameplay commands. Each warm-up and measured run launches a distinct process/profile; OS caches are not cleared. Startup time includes process launch, application readiness, window creation and renderer load, separate from post-ready frame pacing. This is unpackaged native evidence, not Windows package or physical-device performance.

`npm run perf -- --suite reachable --seed 42` generates three journeys through accepted production commands and save/resume, then captures early and late battle checkpoints. Reports retain the generating journal and inventories of encounter, turn, roster, hand, talents and Boons. Empty inventories are explicit; reaching a checkpoint does not imply every talent or reward was exercised. The fixed synthetic fixture remains the default. Both suites support replay and matching-environment comparisons. Performance format 2 rejects old reports; native/browser, cold/warm, seed, suite, viewport, actual DPR and motion settings must match. Timings remain observational.

## Periodic performance and compiler trial

The [performance workflow](../.github/workflows/performance.yml) runs weekly or on manual dispatch. It serializes three baseline captures and three React Compiler captures on the same hosted runner, retaining samples and comparisons for 30 days. `FAUNA_REACT_COMPILER=1 npm run build` enables the stable Babel compiler for the trial; ordinary builds keep it disabled until repeated observations and rendered interaction review justify adoption. Each report hashes the actual build. Hosted timings are observations, without timing pass/fail thresholds; capture completion and checkpoint correctness remain required. Compare equivalent reports and inspect frame gaps, input delay and heap behavior before promoting any optimization. This does not qualify packaged Windows or Deck performance.

## Local diagnostics

The [session-owned collector](ARCHITECTURE.md#discovery-and-diagnostics) records bounded, redacted failures separately from progression. It has no player report/export surface or automatic upload. Inspect its persistence port and focused tests when investigating collection, deduplication or disposal; ordinary features reuse it rather than collecting saves or arbitrary context.

## Task selection and diagnostics

Verification, context and review share the base recorded in worktree-local Git metadata, surviving commits and branch renames. Unregistered non-main branches and detached checkouts use their common ancestor with local main; main defaults to HEAD. Empty selections explicitly run no checks or review.

| Option                  | Behavior                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Explicit paths          | Narrow the selection                                                                                                    |
| `--base <commit>`       | Override the base                                                                                                       |
| `--working-tree`        | Select only uncommitted changes                                                                                         |
| Review `--layers`       | Show committed, staged and unstaged patches, including reverted edits; default review shows the net task change         |
| `--test <suite>`        | Record extra coverage for the integration plan, including failed attempts; execution is deferred to CI by default       |
| `--forget-test <suite>` | Remove an obsolete extra selection                                                                                      |
| `--plan`                | Preview selection without changing remembered intent                                                                    |
| `--plan --related`      | Suggest import-related tests for coverage investigation; suggestions never displace required or explicit suites         |
| `--diagnostic <mode>`   | Run a [bounded investigation](../scripts/README.md#task-check-implementation), subject to the local/CI execution policy |

Only the base and extra suite paths are stored, never passing results. Test and static commands have the same scope on every branch; [Contributing](../CONTRIBUTING.md#verification) owns required coverage and suite maintenance.

## Review and owner lookup

[Task selection](#task-selection-and-diagnostics) applies to these read-only tools; [Contributing](../CONTRIBUTING.md#verification) owns verification coverage. They locate and inspect the selection without staging files or inspecting chats:

| Command                                      | Output                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm run context -- --task combat --task ui` | Canonical guide sections and implementation entrypoints; also accepts source paths and `--json`                     |
| `npm run review:status -- [paths]`           | Bounded file inventory without patch bodies                                                                         |
| `npm run review:diff -- --summary [paths]`   | Inventory plus patch ranges                                                                                         |
| `npm run review:diff`                        | Readable net-task patches; `--layers` includes committed/staged/unstaged layers; `--json` returns structured output |

Context `--help` lists topics, including layout and recovery; unknown topics fail. Bounded output reports omissions and retains the complete JSON under `reports/agent-context/`. These pointers are navigation aids, not test coverage.

Review uses literal Git paths and writes the complete inventory, patch text and 1-based index under `reports/agent-diff/`. Read omitted patches before claiming a complete review. Release identity and player-note commands live in [Release](RELEASE.md#release-verification-and-player-notes).

## Architecture and packaged platform checks

`npm run deadcode` checks the [Knip entrypoints](../knip.config.js), including native and harness consumers. Parser-based boundary checks resolve imports, re-exports and literal dynamic access and reject ambient gameplay capabilities. Keep dynamic consumers explicit; do not delete live code to satisfy a report.

[Packaged integrity](RELEASE.md#packaged-integrity) owns Electron fuses, browser snapshots and exact renderer/media/native-file checks. Packaged smoke connects only to its owned renderer's loopback CDP endpoint and covers draft, inspection, required replacement, saving and quit/resume. Unpackaged smoke separately checks Electron main-process preferences.

Native launchers clear inherited preview URLs, preview profiles and Electron Node mode, use isolated profiles and disable real Steam. Browser/CDP checks simulate input. A development-only `FAUNA_STEAM_APP_ID` may explicitly select Fauna's own app; production uses [steam-config.json](../desktop/steam-config.json), whose App ID defaults to null. Test commands do not configure partner settings or upload progression. Profile separation and device preferences follow [Architecture](ARCHITECTURE.md#cloud-reconciliation-and-device-preferences).
