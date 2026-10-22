# Script implementation map

[Contributing](../CONTRIBUTING.md) owns command selection and verification policy; [AGENTS.md](../AGENTS.md) owns authorization and invariants.

Implementation folders follow workflows: `agent/`, `assets/`, `balance/`, `checks/`, `ci/`, `dev/`, `performance/` and `release/`. Shared Node infrastructure remains in `lib/`; balance analysis lives beside its commands in `balance/`, and performance metrics and route definitions live in `performance/`. Interaction replay validation remains shared because both performance tooling and CI consume it. Worktree creation, cleanup and integration retain their root entrypoints. Use the existing npm commands from any task checkout; file moves do not change command names or verification policy.

| Command or concern                                                               | Implementation owner                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run worktree -- <task-name> [base-ref]`                                     | [worktree.mjs](worktree.mjs): creates/reuses isolated tasks and links matching dependencies                                                                                                                            |
| `node scripts/integrate.mjs <task-branch>`                                       | [integrate.mjs](integrate.mjs), [Git helpers](lib/git.mjs), [shared lock](lib/integration-lock.mjs), [npm launcher](lib/npm-command.mjs)                                                                               |
| `npm run deps`                                                                   | [dependencies.mjs](dependencies.mjs): reuses matching shared dependencies or detaches only the task link before a local install                                                                                        |
| `npm run worktree:cleanup -- [--apply]`                                          | [worktree-cleanup.mjs](worktree-cleanup.mjs): audits or removes clean merged tasks under the shared lock and archives ignored artifacts                                                                                |
| `npm run check`, `npm run verify`                                                | [check.mjs](checks/check.mjs): batched formatting/lint/contracts, compiler environments, import-related suites and `--plan` coverage preview                                                                           |
| `npm test`                                                                       | [run-local-tests.mjs](checks/run-local-tests.mjs), [local test config](../vitest.local.config.mjs)                                                                                                                     |
| `npm run docs:check`                                                             | [check-docs.mjs](checks/check-docs.mjs), [Markdown helpers](lib/markdown.mjs)                                                                                                                                          |
| `npm run check:bundle`                                                           | [check-bundle-budget.mjs](checks/check-bundle-budget.mjs), [measured allowance](checks/bundle-budget.mjs)                                                                                                              |
| CI unit/browser failure summaries                                                | [ci-summarize.mjs](ci/ci-summarize.mjs), [workflow](../.github/workflows/ci.yml), [browser reporters](../playwright.config.ts)                                                                                         |
| Architecture and UI source contracts                                             | [boundaries.mjs](checks/boundaries.mjs), [ui-contract.mjs](checks/ui-contract.mjs), [primitive registry](checks/shadcn-registry.json)                                                                                  |
| `npm run preview:task`, `npm run capture:task`                                   | [preview.mjs](dev/preview.mjs), [capture.mjs](dev/capture.mjs), [scenarios](dev/review-scenarios.mjs): isolated previews and seeded captures                                                                           |
| `npm run assets:prepare`, `npm run assets:check`, `npm run assets:check:outputs` | [assets.mjs](assets/assets.mjs), [art recipes](assets/art-recipes.mjs), [active build inventory](assets/active-assets.mjs), [art review](assets/art-review.mjs); [media contracts](../Docs/CONTENT.md#prepared-assets) |
| `npm run content:audit`                                                          | [content-audit.mjs](checks/content-audit.mjs); [pure validator](../src/game/content-validation.ts)                                                                                                                     |
| `npm run balance:playthrough`                                                    | [run-playthrough.mjs](balance/run-playthrough.mjs); [journey runner](../src/tooling/playthrough.ts)                                                                                                                    |
| `npm run audio:review`                                                           | [audio-review.mjs](assets/audio-review.mjs); [tool workflows](../Docs/DEVELOPMENT_TOOLS.md)                                                                                                                            |
| `npm run dev:desktop`                                                            | [dev-desktop.mjs](dev/dev-desktop.mjs)                                                                                                                                                                                 |
| `npm run dev`                                                                    | [dev.mjs](dev/dev.mjs): opens the local URL in Safari on macOS, or the default browser on other platforms                                                                                                              |
| `npm run test:desktop`                                                           | [smoke-desktop.mjs](release/smoke-desktop.mjs)                                                                                                                                                                         |
| Placeholder authoring                                                            | [create-location-placeholders.mjs](assets/create-location-placeholders.mjs); [artwork policy](../Docs/CONTENT.md)                                                                                                      |

CI orchestration and completeness are owned by [ci.mjs](ci/ci.mjs) and the [workflow](../.github/workflows/ci.yml). The build job assigns exact Playwright test lists by the duration estimates in [browser-durations.json](ci/browser-durations.json); new cases remain included with a default weight. The gate exports refreshed estimates in `browser-review` and checks commit/run identities and matching build hashes across rerun attempts, all discovered browser cases, upstream job results, unit results and the seeded interaction trace. Unit totals must match the recorded passing assertions; the mixed interaction trace must contain valid actions and a checkpoint hash for every completed step. [ci-timings.mjs](ci/ci-timings.mjs) records GitHub job and step timings for a run and optional attempt; see [CI measurements](../Docs/archive/CI_SPEED_PLAN.md#baseline-and-success-measures).

Additional opt-in tools:

- `npm run assets:review`: [original/prepared comparisons](assets/art-review.mjs); see [quality and resolution](../Docs/CONTENT.md#artwork-resolution-and-quality).
- `npm run assets:check:bundle`: [active media inventory and size budgets](assets/active-assets.mjs) against an existing build.
- `npm run balance:findings`: [ranked findings](balance/balance-findings.mjs), [analysis and thresholds](balance/findings.mjs); analyzes existing reports without simulations.
- `npm run verify:release-version`, `npm run verify:release`: [read-only release gate](release/verify-release.mjs), [build identity](lib/release-identity.mjs); no build or publication.
- `npm run generate:patch-notes`: [history filtering and draft generation](release/generate-patch-notes.mjs); see [release workflow](../Docs/RELEASE.md#release-verification-and-player-notes).
- `npm run balance:compare`: [balance-compare.mjs](balance/balance-compare.mjs), [paired report math](balance/paired-balance.mjs), [production cases](../src/tooling/balance.ts).
- `npm run perf`, `npm run perf:replay`, `npm run perf:compare`: [capture driver](performance/run-performance.mjs), [metrics](performance/metrics.mjs), [validated fixtures](../src/tooling/performance.ts).
- `npm run verify:package`: [package gate](release/verify-package.mjs), [after-pack hardening](../desktop/after-pack.cjs), [packaged renderer launcher](lib/packaged-desktop.mjs).
- `npm run check:types`: the gameplay, renderer, Node tooling and test/design compiler environments described in [architecture](../Docs/ARCHITECTURE.md#typescript-environments); selected environments run locally through `check`; all environments run in CI as part of `npm run check:full`.
- `npm run deadcode`: [Knip entrypoints](../knip.config.js); full CI static verification only.
- `npm run investigate`: [bounded diagnostic launcher](agent/investigate.mjs); authorization and budgets live in [Contributing](../CONTRIBUTING.md#execution-and-evidence).
- `npm run context`: [owner lookup](agent/agent-context.mjs), including runtime guidance for focused unit suites alongside test policy.
- `npm run review:status`, `npm run review:diff`: [bounded patch review](agent/agent-review.mjs).
- `npm run test:e2e:route`: [named route launcher](performance/test-route.mjs), [route definitions](performance/routes.mjs).
- `npm run test:interactions`: [rendered seeded runner](performance/run-interactions.mjs), [bounded reducer and replay validation](lib/interaction-replay.mjs).
- Shared source identities, report-directory confinement and Node module loading: [tool-runtime.mjs](lib/tool-runtime.mjs).
- Playthrough and balance worker deadlines, cancellation and exit ownership: [worker.mjs](lib/worker.mjs).
- Isolated smoke and performance desktop launch environments: [desktop-environment.mjs](lib/desktop-environment.mjs).

See [Development tools](../Docs/DEVELOPMENT_TOOLS.md) for scenarios, defaults, evidence and limitations, [verification](../CONTRIBUTING.md#verification) for local completion, and [CI](../Docs/CI.md) for hosted pipeline details. [Affected test selection](checks/affected-tests.mjs) follows the reverse import graph for the local task check.

Documentation parsing, measured bundle checks, worktree setup, integration safeguards and CI summary patterns are adapted from the sibling Alchemy repository. They have no runtime dependency on that checkout. Fauna retains its own command policy, save rules, worktree cleanup and release identity.

## Bundle allowance

[bundle-budget.mjs](checks/bundle-budget.mjs) owns the current baseline (774,677 uncompressed JavaScript bytes), allowance (800 KiB) and warning threshold (95%). The [measurement history](../Docs/archive/BUNDLE_SIZE_HISTORY.md) retains build identities and the reasons for previous changes. CI measures the exact pushed commit; the recorded baseline establishes size only.

The checker sums all JavaScript files recursively and rejects missing or empty entry bundles. Chunk splits do not create extra allowance. Investigate unexpected growth before raising the ceiling; update the measured baseline and reason together when intentional growth needs a new allowance. This gate measures JavaScript size, not artwork downloads, frame pacing or device performance. Run it against an existing build; build execution follows [the single verification policy](../CONTRIBUTING.md#execution-and-evidence).

Dependency security is owned by [security-audit.mjs](checks/security-audit.mjs) through `npm run security:audit`. The expiring build-tool advisory exception is documented in [CI](../Docs/CI.md). [Periodic performance](../.github/workflows/performance.yml) runs the existing capture/comparison commands, including the optional compiler build. [Signed Windows candidates](../.github/workflows/release-candidate.yml) use `npm run package:installer`; see [release qualification](../Docs/RELEASE.md#candidate-signing-and-qualification).

`npm run check:types` uses [typecheck.mjs](checks/typecheck.mjs) to report every compiler environment in one CI pass. Static CI runs the type, lint, formatting, boundary and unused-code commands independently, retaining failure status while reporting all categories. `npm run check:full` remains their sequential entrypoint.

Production builds run `npm run generate:release-inventory` through [dependency inventory](release/dependency-inventory.mjs) to package dependency and license notices. Its `--package` mode retains final Windows component hashes; see [release provenance](../Docs/RELEASE.md#dependency-inventory-and-provenance).

## Task check implementation

Selection defaults to the task branch common ancestor with main, including committed and working changes. `--working-tree` and `--diff` select HEAD explicitly. Verification records live in the worktree Git directory, outside source and reports. They include all tracked/untracked non-ignored source bytes, selected paths, base, runtime and environment (excluding npm invocation metadata and shell directory variables), plus installed file metadata. Tool cache directories are excluded. Any changed input invalidates reuse; deleted/corrupt records run checks normally. Only successful stable-input runs create records.

Before execution it prints the selected files, formatting batches, owning compiler environments, documentation coverage, focused suites and omissions. Formatting and lint use batches of at most 50 files, 256,000 source bytes and 8,000 argument bytes; a single larger file runs alone. Every existing selected source file receives its architecture/UI contracts, even across multiple batches. Larger selections never silently drop formatting, lint or contracts. Deleted source files still select their compiler environment; dependency/configuration changes select all environments.

Changed regression suites and existing filename-matched owner suites always run. A reverse import graph adds up to twelve further unit/integration suites, following transitive static imports, re-exports and literal `import()`/`require()` calls, including aliases. Additional related suites and files the graph could not parse are listed explicitly for CI. Computed imports, runtime file reads and external dependencies are not inferred; select a relevant regression by name when needed. If no suite matches, the fixed Node smoke runs and is labeled as smoke rather than affected-behavior coverage. Documentation-only changes run no tests.

Each lint/compiler/focused-suite subprocess has a 60-second deadline, a 1 GiB Node heap and one test worker. Focused suites run serially, one per subprocess; a timeout or failure blocks the gate. The standalone `npm test` smoke has one worker, a 512 MiB heap and a 30-second deadline. The task gate never installs dependencies, builds, launches browsers/Electron or publishes anything. If shared dependencies differ or are incomplete, it directs you to `npm run deps`.

## Worktree operations

The command creates `.worktrees/<task-name>` on `task/<task-name>` from committed local main by default. An existing matching checkout is reused without resetting files. Existing branches without that checkout and conflicting directories are preserved and rejected. Dependencies are linked from main only when dependency manifests, install settings and lifecycle scripts match. Run `npm run deps` in the task checkout when dependencies are missing or change: it reuses a matching shared link or detaches only that link and runs `npm ci` locally, using the project-pinned npm without changing the global install. Never run `npm ci` through a shared dependency link. Changing ordinary npm task commands alone does not invalidate dependencies.

Review the task diff, run its checks, and commit task-owned files. From clean main:

```sh
node scripts/integrate.mjs task/creature-feedback
```

Integration holds one repository-wide lock, incorporates the locked main commit in the task checkout, checks the combined result and advances clean main. Dirty checkouts and unfinished Git operations block it. A competing integration fails as busy; retry later without terminating its owner. The OS releases the lock on exit, including crashes. A legacy directory lock is respected during the transition; inspect its owner before any separately authorized cleanup. Both worktrees are rechecked before main advances. Failed checks preserve committed task work. Successful integration removes its clean merged checkout and local branch while still holding the lock. Cleanup failure for the integrated task is reported separately even if main already advanced; inspect that task and retry its cleanup. Git authorization is defined only in [AGENTS.md](../AGENTS.md#worktrees-and-integration).

Optional repository maintenance, independent of completing an implementation task: audit accumulated local task branches and worktrees from clean main:

```sh
npm run worktree:cleanup
# Remove eligible merged tasks:
npm run worktree:cleanup -- --apply
```

Only local branches under `task/` or `codex/` whose commits are already in main are eligible. The sweep uses the integration lock and preserves dirty, unmerged, locked and unfinished checkouts. It never merges unreviewed work, forces removal, deletes remote branches or terminates preview processes. Preserved tasks are expected and reported without failing the sweep; they do not block another task. Operational failures such as an unavailable lock still fail. Integration automatically cleans only the task being integrated, so another chat's newly created clean checkout is not swept during routine integration.

Before removal, ignored artifacts (reports, screenshots, logs and other ignored files) are copied to `fauna-worktree-archives/` inside the shared Git directory, with a manifest identifying the original checkout, branch and commit. Dependency installs and links under the checkout's root `node_modules` are disposable and are not archived. Archives remain local and are never automatically deleted; find them with `git rev-parse --git-common-dir`. Tracked and untracked changes always block removal. Close only preview processes owned by the completed task before its integration; cleanup does not stop processes or establish that another chat has finished.
