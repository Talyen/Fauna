# Development tools

## Task checkouts and previews

`npm run worktree -- short-name` from the main checkout creates `task/short-name` from committed local main in `.worktrees/short-name`, or reuses the matching checkout. Dirty main is preserved. Dependencies are linked only when lockfiles and package manifests match; changed dependencies require a worktree-local installation. Continue to integrate with `node scripts/integrate.mjs task/short-name` from clean main. Setup does not delete checkouts or push branches.

`npm run preview:task -- --browser` starts a quiet Vite preview on its own localhost port and opens a fresh headed Chromium context at 1920×1080. `--desktop` opens Electron with a separate user-data directory. Without either flag, the command starts only the server. Browser mode requires an installed Playwright Chromium binary. Preview execution is opt-in; agents run it only when requested.

Each session records its random identity, port, checkout and owner PID under ignored `reports/previews/`. Readiness verifies a per-session endpoint. Ctrl+C closes only owned process handles and that server/context. Records never authorize killing a PID later. Quiet previews cannot emit game audio. Use normal `npm run dev` for an audible browser listening session; `npm run dev:desktop` uses the owned quiet desktop preview. Only dispose sessions opened for the current task.

## Content checks

`npm run content:audit` reports authored-content errors and warnings by stable ID and field, and writes `reports/content-audit.json`. The pure validator in `src/game/content-validation.ts` also supplies startup validation through the existing `validateContent` export. It checks IDs, owners, supported magnitudes/costs, effect and keyword registration, encounter packs, boss positions, stats, and talent rows/references. Missing player cards for a progression keyword are advisory warnings.

Card descriptions derive from their structured effects. Handwritten traits, boons and talent prose still need focused gameplay tests and review; the validator does not prove arbitrary English describes a resolver correctly. Media checks validate manifest coverage, image geometry, preparation identities and output bytes. CI runs the content audit; it is not added to the bounded default local smoke.

## Headless journeys

```sh
npm run balance:playthrough -- --seed 42 --runs 2 --starter emberback --policy heuristic
npm run balance:playthrough -- --replay reports/playthrough/journey.json --out reports/replay
npm run balance:playthrough -- --seed 42 --runs 2 --compare reports/baseline/journey.json --out reports/comparison
```

The opt-in runner uses production application commands, current save validation, serialized in-memory writes and periodic save/resume. Policy randomness is separate from gameplay randomness. The heuristic attacks vulnerable enemies, restores injured allies, buys available talents and replaces fallen deployed creatures with healthy reserves. Random policy randomizes visible legal card choices; both policies use only the player-visible offer and creature state. Neither reads enemy target intentions or future offers. Recruitment grows the roster and chooses an existing individual to release at capacity; those choices do not imply a human-optimal team.

`--save path` explicitly starts from a current-format checkpoint. Otherwise each career begins without earned progression. Repeated journeys retain earned progress. `--seed`, `--runs` (1–20), `--starter`, `--policy` (`heuristic` or `random`) and `--out` select the scenario. `--starter` is a preference among the saved offers, not a forced pick: when it is absent, the policy chooses another offered species using its separate seeded RNG. The CLI accepts only species in `FIRST_RUN_STARTERS`, even with `--save`; a checkpoint still controls the actual available offers. Reports must stay under `reports/`; output directory components cannot be symlinks.

`journey.json` contains the initial checkpoint, complete attempted command journal, acceptance results, and canonical validated state/RNG checkpoints. `summary.json` includes outcomes, encounters reached, cumulative action counts, battle lengths and lineups, first/second talent-point milestones, roster, retained currency/XP and completion status. An append-only per-attempt journal is written before each command and after its save acknowledgement; interrupted runs leave an incomplete summary and the journal path. Replay requires matching code/content identity and fails on any divergence. Comparison requires completed careers with matching initial checkpoints and scenario settings; a different code identity is reported explicitly. Changes to starting save formats require a fresh baseline rather than inventing historical state.

An external 60-second watchdog, 5,000-action budget and 100-turn-per-battle budget prevent hangs from becoming reported victories or defeats. Incomplete runs fail the command. Small focused replay tests run in CI; larger sweeps remain opt-in. These are automated-policy observations, not human win-rate estimates or rendered acceptance.

## Local diagnostics

The internal collector retains bounded deduplicated failures with selected revision/phase fields. Error text is truncated and common absolute paths and credential assignments are redacted. Full saves and arbitrary context objects are never captured. Entries persist separately from progression; unavailable storage leaves in-memory evidence. There is no player-facing diagnostics tab, report or clipboard export. Nothing is uploaded automatically.

The application session owns collection lifetime and records save read/write and validation failures. The root boundary records render failures; startup registers global error/rejection listeners. Audio failures are non-fatal diagnostics. Disposing a session revokes further collection while admitted saves drain normally.

## Prepared media and Sound desk

See [Content and artwork](CONTENT.md#prepared-assets) for manifest authoring, preparation, receipts and source checks. `npm run audio:review` generates ignored review inputs. `npm run audio:review -- --serve` opens an explicitly served local Sound desk on a free port; run it for listening only when requested. It serves only registered prepared media and the review page.

The desk compares current assignments with any prepared candidate of the same kind, offers original or level-matched playback, and saves local choices against the manifest identity. Playback stops on another audition, selection changes, page hiding, or Stop. Export choices explicitly; auditioning and choosing never install replacements. Exported source/output hashes identify the exact recording. Adopt a choice by updating the manifest and preparing again. Listening and device/mix acceptance remain separate from successful metadata checks.

## Paired balance reports

`npm run balance:compare -- run` defaults to five starter preferences (Mossguard, Emberback, Pollenmoth, Prismram and Captoad) crossed with seeds 0–9, serially. This is a fixed benchmark subset, not coverage of the full current starter pool; each preference is chosen only when present in the seeded offers. Each case uses the production heuristic policy, explicit Auto-end turn enabled, a 5,000-action/100-turn limit, save/resume every 17 actions and a 60-second watchdog. The suite has a fifteen-minute deadline. Ctrl+C or termination stops the owned worker and prevents further cases; the report remains incomplete. A watchdog waits for the stopped worker to exit before another case can start. `--starters emberback --seeds 0,1 --out reports/balance/smoke` provides a bounded two-case smoke. Custom suites accept up to five distinct starter preferences and ten distinct seeds. Reports contain explicit incomplete outcomes rather than converting timeouts to defeats.

Run the identical suite in each code version, then use `npm run balance:compare -- compare reports/balance/before/report.json reports/balance/after/report.json`. Reports require matching scenario settings and initial checkpoint hashes, but permit explicitly identified code/content changes. `comparison.json` records paired mean differences and standard errors for wins, turns, remaining roster Health, encounter reached, swaps, retained currency and XP. Differences within two standard errors are noisy; one pair cannot estimate uncertainty. These are automated-policy observations, not human win rates.

`npm run balance:compare -- experiment --checkpoint reports/checkpoint.json --loadouts reports/loadouts.json --out reports/balance/experiment` compares two arms from the same validated battle checkpoint. The loadouts JSON has `baseline` and `treatment`, each containing explicit `talents` and `boons` ID arrays. Both retain the same XP budgets and all other checkpoint fields; invalid prerequisites, budgets and IDs fail. Grants are identified as fixtures, not earned progression. Already-settled battle-start effects are not replayed when injecting loadouts into an active battle; use a checkpoint with the intended starting combat state when studying them. Each arm writes command/checkpoint evidence and an automatic paired comparison.

`npm run balance:compare -- replay reports/balance/smoke/case-0.json` directly replays recorded commands and fails on code identity, checkpoint divergence or incomplete execution. Playthrough and balance tools share a source fingerprint covering gameplay and application files, including the save-format JSON. Record fresh journals after changing these inputs. All output remains under ignored `reports/`. The existing `balance:playthrough` replay format is now version 3; obsolete journals are rejected.

## Reproducible performance captures

Builds and performance captures are CI-owned by default; the commands below are for an explicitly requested local investigation or an authorized CI run.

Build once with `npm run build`, then run `npm run perf -- --out reports/performance/baseline`. The three scenarios cover card play/enemy turns, free swaps, and Collection/menu transitions. `--scenario battle`, `swap`, or `menus` selects one. A named fixture explicitly grants three deployed creatures and one reserve; it is validated as a current-format save, not claimed to be earned progression. The driver uses normal controls in fresh browser contexts, an owned production preview on a free port, and muted speaker output.

Each scenario gets one unmeasured warm-up and one measured run at 1280×800 with normal motion and Auto-end turn disabled. Action segments retain 1,200 ms of ordinary transition/feedback time. Reports include frame percentiles, gap counts over 20/33.3/50/100 ms, supported long-task/input timings, and heap/DOM/media observations. Unsupported metrics are null. At least sixty frame gaps and ten frames per completed action segment are required. Stalled actions, missing samples and divergent saves fail the capture.

`npm run perf:replay -- reports/performance/baseline/report.json reports/performance/replay` repeats its exact checkpoint and controls. `npm run perf:compare -- reports/performance/baseline/report.json reports/performance/replay/report.json` writes differences only for compatible environments, fixtures and action/checkpoint hashes. Raw samples, segments, build hashes and replay inputs remain beside the summary. Build hashes cover every emitted renderer and media file, desktop files, package metadata and the save-format JSON. Run captures without competing local workloads; browser timing is observational and does not prove physical controller, GPU presentation, Proton or Deck performance. Capture and replay do not rebuild.

## Review and owner lookup

`npm run context -- --task combat --task ui` prints canonical documentation section ranges and implementation entrypoints. It also accepts source paths or `--diff`, including untracked files, and `--json`. Unknown topics fail. Output is bounded, with explicit omitted-pointer counts and a complete JSON selection under `reports/agent-context/`. Owner pointers are navigation aids, not test coverage.

`npm run review:status -- [paths]` provides a bounded inventory without reading patch bodies; `npm run review:diff -- --summary [paths]` adds patch ranges. Ordinary `review:diff` previews staged, unstaged and untracked changes; `--json` supplies structured output. A complete inventory, patch text and 1-based patch index are written under ignored `reports/agent-diff/`. Truncation is explicit; read omitted patches before claiming a complete review. Commands use literal Git paths, never stage files or mutate checkout state, and never inspect chats.

The packaged artifact gate is documented in [Release readiness](RELEASE.md#packaged-integrity). These opt-in tools do not expand the default local verification gate.

## Focused routes and seeded interactions

`npm run test:e2e:route -- battle --list` lists a named route without launching it. Routes are battle, settings, collection, progression and persistence; remove `--list` to run one. They select fixed files and title filters and accept only `--list`, `--headed` or `--debug`, so a typo cannot silently launch the whole suite. CI still runs every browser test.

After building, `npm run test:interactions -- --seed 42 --steps 24 --family mixed` drives rendered controls in an isolated profile. Navigation, battle and persistence families can also run separately. Reports retain seed, current-format initial checkpoint, source identity, attempted actions and checkpoint hashes under ignored reports. Battle actions are checked against the production dispatcher; menu actions must preserve progression. Reload exercises save/resume. This is bounded seeded coverage, not exhaustive UI exploration.

`npm run test:interactions -- --replay reports/interactions/example/report.json` replays exact actions and hashes, rejecting changed source identity. Add `--shrink true` on failure for deletion-based reduction, with a fresh context for each candidate and a budget of 40 attempts / 30 seconds. Inapplicable commands and different failure signatures cannot replace the original failure. The original trace remains intact; `minimal.json` is a separate replayable candidate. A bounded shrink does not claim global minimality.

## Native and reachable performance scenarios

`npm run perf -- --electron --scenario battle` uses the production renderer through Electron's sandboxed preload and file saves in a fresh temporary profile. Speaker output is muted without disabling the audio graph. Native captures use a frameless 1280×800 content window so desktop title bars cannot clamp the viewport. This harness setting is recorded and does not alter ordinary launch behavior. Set `FAUNA_ELECTRON_EXECUTABLE` only to explicitly select an installed runtime; the report records its actual version. `npm run perf -- --electron --cold` captures new-process launch to visible Continue, followed by an idle frame sample. Cold startup uses default preferences and issues no gameplay commands. Each warm-up and measured run launches a distinct process/profile; OS caches are not cleared. Startup time includes process launch, application readiness, window creation and renderer load, separate from post-ready frame pacing. This is unpackaged native evidence, not Windows package or physical-device performance.

`npm run perf -- --suite reachable --seed 42` generates three journeys through accepted production commands and save/resume, then captures early and late battle checkpoints. Reports retain the generating journal and inventories of encounter, turn, roster, hand, talents and Boons. Empty inventories are explicit; reaching a checkpoint does not imply every talent or reward was exercised. The fixed synthetic fixture remains the default. Both suites support replay and matching-environment comparisons. Performance format 2 rejects old reports; native/browser, cold/warm, seed, suite, viewport, actual DPR and motion settings must match. Timings remain observational.

## Architecture and packaged platform checks

`npm run deadcode` runs Knip with explicit application, native, SSR harness and tooling entrypoints. Parser-based architecture checks resolve relative and alias imports, re-exports and literal dynamic access and reject gameplay ambient capabilities. Both run in full CI static verification; the default bounded local gate is unchanged. Keep registered upstream primitives and dynamic consumers explicit rather than removing live code to satisfy a report.

Electron after-pack configuration installs browser-process snapshots and sets hardened fuses. `npm run verify:package` checks actual executable fuse values, snapshot bytes, required Steam native files, desktop runtime and save-format bytes, and existing renderer/media identity. Packaged smoke connects only to the owned renderer's loopback CDP endpoint; it does not weaken Node inspection fuses. It retains draft, inspection, free swaps, saving and quit/resume coverage. Unpackaged smoke retains its Electron main-process preference assertions. Desktop verification launches clear inherited preview URLs, preview profiles and Electron Node mode, use their own temporary profiles, and disable live Steam access. Browser/CDP evidence is separate from physical input and live Steam acceptance.

All native automated launchers use isolated profiles and disable real Steam. `desktop/steam-config.json` defaults to a null App ID; a development-only `FAUNA_STEAM_APP_ID` may explicitly select Fauna's own configured app. Production ignores that environment override. No verification command configures Steam partner settings or uploads progression. Display settings use the profile's separate `display.json`; Cloud metadata and recovery snapshots stay with the pinned Steam profile. Do not delete player saves to reset tests.

## Ranked balance findings

Balance runs, experiments and comparisons now write ranked `findings.json` and `findings.md` beside their evidence. `npm run balance:findings -- reports/balance/smoke/report.json` reanalyzes an existing suite without running simulations; an optional second argument selects a directory under ignored reports. It also accepts a generated `comparison.json`. No finding changes gameplay or tuning automatically.

Critical findings identify incomplete evidence, including watchdogs and rejected commands; unfinished cases never become defeats. Review findings identify completed careers averaging over 120 turns, no retained keyword XP, starter success spreads of at least 25 percentage points with matching seed sets and an approximate two-standard-error filter, or supported paired shifts. Paired thresholds are 20 percentage points for success, 5 turns, 5 remaining Health, 20 Gold and 5 keyword XP. Either direction can merit review. These are Fauna review heuristics, not Alchemy's encounter targets or release gates.

At least five samples are needed for review-level statistical findings. Extreme 0%/100% success, small samples and noisy paired effects remain watch items; zero observed variance at an extreme is not certainty. Within each severity, findings rank by threshold-relative magnitude and then stable ID, retaining case/journal references. Career success comparisons are observational, with differing recruitment and policy choices; investigate individual matchups before attributing causation. One-checkpoint experiments remain explicitly small samples. No findings does not establish balanced content or a human win rate.

Release artifact identity checks and player patch-note drafts are documented in [Release readiness](RELEASE.md#release-verification-and-player-notes).
