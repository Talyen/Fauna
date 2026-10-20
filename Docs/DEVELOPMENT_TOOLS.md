# Development tools

## Task checkouts and previews

`npm run worktree -- short-name` from the main checkout creates `task/short-name` from committed local main in `.worktrees/short-name`, or reuses the matching checkout. Dirty main is preserved. Dependencies are linked only when lockfiles and package manifests match; changed dependencies require a worktree-local installation. Continue to integrate with `node scripts/integrate.mjs task/short-name` from clean main. Setup does not delete checkouts or push branches.

`npm run preview:task -- --browser` starts a quiet Vite preview on its own localhost port and opens a fresh headed Chromium context at 1920×1080. `--desktop` opens Electron with a separate user-data directory. Without either flag, the command starts only the server. Browser mode requires an installed Playwright Chromium binary. Preview execution is opt-in; agents run it only when requested.

Each session records its random identity, port, checkout and owner PID under ignored `reports/previews/`. Readiness verifies a per-session endpoint. Ctrl+C closes only owned process handles and that server/context. Records never authorize killing a PID later. Quiet previews cannot emit game audio. Use normal `npm run dev` for an audible browser listening session; `npm run dev:desktop` uses the owned quiet desktop preview. Only dispose sessions opened for the current task.

## Content checks

`npm run content:audit` reports authored-content errors and warnings by stable ID and field, and writes `reports/content-audit.json`. The pure validator in `src/game/content-validation.ts` also supplies startup validation through the existing `validateContent` export. It checks IDs, owners, supported magnitudes/costs, effect and keyword registration, encounter packs, biome locations, and talent rows/references. Missing player cards for a progression keyword are advisory warnings.

Card descriptions derive from their structured effects. Handwritten traits, relics and talent prose still need focused gameplay tests and review; the validator does not prove arbitrary English describes a resolver correctly. Media checks validate manifest coverage, image geometry, preparation identities and output bytes. CI runs the content audit; it is not added to the bounded default local smoke.

## Headless journeys

```sh
npm run balance:playthrough -- --seed 42 --runs 2 --starter emberfox --policy heuristic
npm run balance:playthrough -- --replay reports/playthrough/journey.json --out reports/replay
npm run balance:playthrough -- --seed 42 --runs 2 --compare reports/baseline/journey.json --out reports/comparison
```

The opt-in runner uses production application commands, current save validation, serialized in-memory writes and periodic save/resume. Policy randomness is separate from gameplay randomness. The heuristic attacks vulnerable enemies, restores injured allies, buys available talents and replaces fallen deployed creatures with healthy reserves. Random policy randomizes visible legal card choices; both policies use only the player-visible offer and creature state. Neither reads enemy target intentions or future offers. Recruitment grows the roster and chooses an existing individual to release at capacity; those choices do not imply a human-optimal team.

`--save path` explicitly starts from a current-format checkpoint. Otherwise each career begins without earned progression. Repeated journeys retain earned progress. `--seed`, `--runs` (1–20), `--starter`, `--policy` (`heuristic` or `random`) and `--out` select the scenario. A locked starter cannot be selected without a checkpoint that unlocks it. Reports must stay under `reports/`.

`journey.json` contains the initial checkpoint, complete attempted command journal, acceptance results, and canonical validated state/RNG checkpoints. `summary.json` includes outcomes, encounters reached, cumulative action counts, battle lengths and lineups, first/second talent-point milestones, roster, retained currency/XP and completion status. An append-only per-attempt journal is written before each command and after its save acknowledgement; interrupted runs leave an incomplete summary and the journal path. Replay requires matching code/content identity and fails on any divergence. Comparison requires completed careers with matching initial checkpoints and scenario settings; a different code identity is reported explicitly. Changes to starting save formats require a fresh baseline rather than inventing historical state.

An external 60-second watchdog, 5,000-action budget and 100-turn-per-battle budget prevent hangs from becoming reported victories or defeats. Incomplete runs fail the command. Small focused replay tests run in CI; larger sweeps remain opt-in. These are automated-policy observations, not human win-rate estimates or rendered acceptance.

## Local diagnostics

Settings offers local diagnostics and explicit copy. Reports contain bounded deduplicated errors, build identity, browser/desktop host, and the revision/phase when recorded. Error text is truncated and common absolute paths and credential assignments are redacted. Full saves and arbitrary context objects are never captured. Diagnostics persist separately from progression; unavailable storage leaves in-memory evidence, and failed copying leaves selectable report text. Nothing is uploaded automatically.

The application session owns collection lifetime and records save read/write and validation failures. The root boundary records render failures; startup registers global error/rejection listeners. Audio failures are non-fatal diagnostics. Disposing a session revokes further collection while admitted saves drain normally.

## Prepared media and Sound desk

See [Content and artwork](CONTENT.md#prepared-assets) for manifest authoring, preparation, receipts and source checks. `npm run audio:review` generates ignored review inputs. `npm run audio:review -- --serve` opens an explicitly served local Sound desk on a free port; run it for listening only when requested. It serves only registered prepared media and the review page.

The desk compares current assignments with any prepared candidate of the same kind, offers original or level-matched playback, and saves local choices against the manifest identity. Playback stops on another audition, selection changes, page hiding, or Stop. Export choices explicitly; auditioning and choosing never install replacements. Exported source/output hashes identify the exact recording. Adopt a choice by updating the manifest and preparing again. Listening and device/mix acceptance remain separate from successful metadata checks.
