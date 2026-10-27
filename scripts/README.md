# Script implementation map

[Contributing](../CONTRIBUTING.md) owns command selection and verification policy; [AGENTS.md](../AGENTS.md) owns authorization and invariants.

Implementation folders follow workflows: `agent/`, `assets/`, `balance/`, `checks/`, `ci/`, `dev/`, `performance/` and `release/`. Shared Node infrastructure remains in `lib/`; balance analysis lives beside its commands in `balance/`, and performance metrics and route definitions live in `performance/`. Interaction replay validation remains shared because both performance tooling and CI consume it. Worktree creation, cleanup and integration retain their root entrypoints. Use the existing npm commands from any task checkout; file moves do not change command names or verification policy.

| Command or concern                                                               | Implementation owner                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run worktree -- <task-name> [base-ref]`                                     | [worktree.mjs](worktree.mjs): creates/reuses isolated tasks, records their base and links matching dependencies                                                                                                        |
| `npm run finish` / `npm run integrate -- <task-branch>`                          | [finish.mjs](finish.mjs), [integrate.mjs](integrate.mjs), [Git helpers](lib/git.mjs), [shared lock](lib/integration-lock.mjs), [npm launcher](lib/npm-command.mjs)                                                     |
| `npm run deps`                                                                   | [dependencies.mjs](dependencies.mjs): reuses matching shared dependencies or detaches only the task link before a local install                                                                                        |
| `npm run worktree:cleanup -- [--apply]`                                          | [worktree-cleanup.mjs](worktree-cleanup.mjs): audits or removes clean merged tasks under the shared lock and archives ignored artifacts                                                                                |
| `npm run development:retention -- [--apply]`                                     | [development-retention.mjs](release/development-retention.mjs): audits or removes eligible managed development package outputs                                                                                         |
| `npm run verify:changed` (`verify` compatibility alias)                          | [check.mjs](checks/check.mjs): batched formatting/syntax lint/contracts and `--plan` coverage preview; compiler environments and owner suites are planned for CI                                                       |
| `npm run test:smoke`                                                             | [run-local-tests.mjs](checks/run-local-tests.mjs), [local test config](../vitest.local.config.mjs)                                                                                                                     |
| `npm run docs:check`                                                             | [check-docs.mjs](checks/check-docs.mjs), [Markdown helpers](lib/markdown.mjs)                                                                                                                                          |
| `npm run check:bundle`                                                           | [check-bundle-budget.mjs](checks/check-bundle-budget.mjs), [measured allowance](checks/bundle-budget.mjs)                                                                                                              |
| CI unit/browser failure summaries                                                | [ci-summarize.mjs](ci/ci-summarize.mjs), [workflow](../.github/workflows/ci.yml), [browser reporters](../playwright.config.ts)                                                                                         |
| Architecture and UI source contracts                                             | [boundaries.mjs](checks/boundaries.mjs), [modifier-contracts.mjs](checks/modifier-contracts.mjs), [ui-contract.mjs](checks/ui-contract.mjs), [primitive registry](checks/shadcn-registry.json)                         |
| `npm run preview:task`, `npm run capture:task`                                   | [preview.mjs](dev/preview.mjs), [capture.mjs](dev/capture.mjs), [scenarios](dev/review-scenarios.mjs): isolated previews and seeded captures                                                                           |
| `npm run assets:prepare`, `npm run assets:check`, `npm run assets:check:outputs` | [assets.mjs](assets/assets.mjs), [art recipes](assets/art-recipes.mjs), [active build inventory](assets/active-assets.mjs), [art review](assets/art-review.mjs); [media contracts](../Docs/CONTENT.md#prepared-assets) |
| `npm run content:audit`                                                          | [content-audit.mjs](checks/content-audit.mjs); [pure validator](../src/game/content-validation.ts)                                                                                                                     |
| `npm run balance:playthrough`                                                    | [run-playthrough.mjs](balance/run-playthrough.mjs); [journey runner](../src/tooling/playthrough.ts)                                                                                                                    |
| `npm run audio:review`                                                           | [audio-review.mjs](assets/audio-review.mjs); [tool workflows](../Docs/DEVELOPMENT_TOOLS.md)                                                                                                                            |
| `npm run dev:desktop`                                                            | [dev-desktop.mjs](dev/dev-desktop.mjs)                                                                                                                                                                                 |
| `npm run dev`                                                                    | [dev.mjs](dev/dev.mjs): opens the local URL in Safari on macOS, or the default browser on other platforms                                                                                                              |
| `npm run test:desktop`                                                           | [smoke-desktop.mjs](release/smoke-desktop.mjs)                                                                                                                                                                         |
| Placeholder authoring                                                            | [create-location-placeholders.mjs](assets/create-location-placeholders.mjs); [artwork policy](../Docs/CONTENT.md)                                                                                                      |

[CI](../Docs/CI.md) owns scheduling, completeness, reruns and artifacts. Its implementations are [ci.mjs](ci/ci.mjs), the [lineup partition](ci/unit-shards.mjs), the [workflow](../.github/workflows/ci.yml), [duration estimates](ci/browser-durations.json) and [timing reader](ci/ci-timings.mjs).

Additional opt-in tools:

- `npm run assets:review`: [original/prepared comparisons](assets/art-review.mjs); see [quality and resolution](../Docs/CONTENT.md#artwork-resolution-and-quality).
- `npm run assets:check:bundle`: [active media inventory and size budgets](assets/active-assets.mjs) against an existing build.
- `npm run balance:findings`: [ranked findings](balance/balance-findings.mjs), [analysis and thresholds](balance/findings.mjs); analyzes existing reports without simulations.
- `npm run verify:release-version`, `npm run verify:release`: [read-only release gate](release/verify-release.mjs), [build identity](lib/release-identity.mjs); no build or publication.
- Signed candidate CI prerequisite: [require-ci.mjs](release/require-ci.mjs) checks the exact commit and successful final verification job in a pinned run attempt, excluding suppressed duplicate runs.
- `npm run generate:patch-notes`: [history filtering and draft generation](release/generate-patch-notes.mjs); see [release workflow](../Docs/RELEASE.md#release-verification-and-player-notes).
- `npm run balance:compare`: [balance-compare.mjs](balance/balance-compare.mjs), [paired report math](balance/paired-balance.mjs), [production cases](../src/tooling/balance.ts).
- `npm run perf`, `npm run perf:replay`, `npm run perf:compare`: [capture driver](performance/run-performance.mjs), [bounded sampler](performance/sampler.mjs), [trace capture/accounting](performance/trace.mjs), [metrics](performance/metrics.mjs), [validated fixtures](../src/tooling/performance.ts).
- `npm run verify:package`: [package gate](release/verify-package.mjs), [after-pack hardening](../desktop/after-pack.cjs), [packaged renderer launcher](lib/packaged-desktop.mjs).
- `npm run check:types`: the gameplay, renderer, Node tooling and test/design compiler environments described in [architecture](../Docs/ARCHITECTURE.md#typescript-environments); selected environments are reported by `verify:changed`; all environments run in CI as part of `npm run check:full`.
- `npm run deadcode`: [Knip entrypoints](../knip.config.js); included in full CI static verification; local investigation requires explicit heavy-local authorization.
- `npm run investigate`: [bounded diagnostic launcher](agent/investigate.mjs); authorization and budgets live in [Contributing](../CONTRIBUTING.md#execution-and-evidence).
- `npm run context`: [owner lookup](agent/agent-context.mjs), including runtime guidance for focused unit suites alongside test policy.
- `npm run review:status`, `npm run review:diff`: [bounded patch review](agent/agent-review.mjs).
- `npm run test:e2e:route`: [named route launcher](performance/test-route.mjs), [route definitions](performance/routes.mjs).
- `npm run test:interactions`: [rendered seeded runner](performance/run-interactions.mjs), [bounded reducer and replay validation](lib/interaction-replay.mjs).
- Shared source identities, report-directory confinement and Node module loading: [tool-runtime.mjs](lib/tool-runtime.mjs).
- Playthrough and balance worker deadlines, cancellation and exit ownership: [worker.mjs](lib/worker.mjs).
- Isolated smoke, preview and performance desktop launch environments: [desktop-environment.mjs](lib/desktop-environment.mjs).

See [Development tools](../Docs/DEVELOPMENT_TOOLS.md) for scenarios, defaults, evidence and limitations, [verification](../CONTRIBUTING.md#verification) for local completion, and [CI](../Docs/CI.md) for hosted pipeline details. [Import-related test discovery](checks/affected-tests.mjs) is available with `verify:changed -- --plan --related` for coverage investigations.

Documentation parsing, measured bundle checks, worktree setup, integration safeguards and CI summary patterns are adapted from the sibling Alchemy repository. They have no runtime dependency on that checkout. Fauna retains its own command policy, save rules, worktree cleanup and release identity.

## Bundle allowance

[bundle-budget.mjs](checks/bundle-budget.mjs) owns the measured baseline, allowance and warning threshold. The [measurement history](../Docs/archive/BUNDLE_SIZE_HISTORY.md) retains build identities and the reasons for previous changes. CI measures the exact pushed commit; the recorded baseline establishes size only.

The checker sums all JavaScript files recursively and rejects missing or empty entry bundles. Chunk splits do not create extra allowance. Investigate unexpected growth before raising the ceiling; update the measured baseline and reason together when intentional growth needs a new allowance. This gate measures JavaScript size, not artwork downloads, frame pacing or device performance. Run it against an existing build; build execution follows [the single verification policy](../CONTRIBUTING.md#execution-and-evidence).

Dependency audit policy lives in [CI](../Docs/CI.md); release inventory, package verification and signed-candidate setup live in [Release](../Docs/RELEASE.md). The command map above locates their implementations.

## Task check implementation

[Tool selection](../Docs/DEVELOPMENT_TOOLS.md#task-selection-and-diagnostics) owns base/option semantics; [Contributing](../CONTRIBUTING.md#verification) owns coverage. Implementation details:

| Concern            | Owner and behavior                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input identity     | [input-identity.mjs](checks/input-identity.mjs) detects source changes and binds captures to renderer, media, fixtures, tooling and runtime; installed dependencies are not recursively fingerprinted |
| Batching           | Formatting/lint batches contain at most 50 files, 256,000 source bytes and 8,000 argument bytes; larger single files run alone; contracts cover all batches                                           |
| Compiler selection | Deleted sources still select their environment; dependency/configuration changes select every environment                                                                                             |
| Required suites    | Changed suites, filename matches and the longest matching prefix in [test-owners.json](checks/test-owners.json); missing required suites block verification                                           |
| CI-owned suites    | Exact suite entries with `tier: "ci"` in the owner registry report deferred automatic execution and select local contracts; full Vitest discovery retains them                                        |
| Extra suites       | [task-intent.mjs](lib/task-intent.mjs) retains explicit selectors through failed checks for integration; plan mode is read-only                                                                       |
| Test execution     | [Execution policy](../CONTRIBUTING.md#execution-and-evidence) applies to remembered selections and explicit diagnostics; results use ignored `reports/task-tests.json`                                |

[The diagnostic launcher](agent/investigate.mjs) validates modes and names before launch and owns cancellation. Its [modes and options](../Docs/DEVELOPMENT_TOOLS.md#bounded-diagnostics) belong to the tool reference.

## Worktree operations

[Resource efficiency](../Docs/RESOURCE_EFFICIENCY.md) owns disk/memory inventories, `npm run resources`, explicit `npm run assets:prune` maintenance and dependency reattachment with `npm run deps -- --share`.

The [shared launcher](local.mjs) enforces [execution budgets](../CONTRIBUTING.md#execution-and-evidence) and checks dependency readiness without installing during routine verification. CSS guards use [PostCSS](https://github.com/postcss/postcss); primitive provenance lives in the registry.

[Task setup and dependencies](../CONTRIBUTING.md#dependencies-and-source-assets) owns reuse, installation and source-asset checkout instructions. Implementation-specific storage behavior follows.

Large retained tracked assets (at least 256 KiB) automatically use per-file APFS
copy-on-write from clean files in main whose bytes match the task commit. An optional Python standard-library
bridge calls Apple's `clonefile` directly. Unsupported platforms/volumes, absent Python,
dirty/mismatched sources and checkout filters use ordinary Git. Cloned bytes/modes
are checked against target blobs, with fresh Git indexes and normal status checks.
No dependency or build-cache copying is added. Creation reports logical bytes omitted
and cloned, plus population/first-status time; APFS extent sharing means these are
not measured physical savings. Existing task checkouts retain their configuration.

[Contributing](../CONTRIBUTING.md#worktrees-and-integration) owns the review/commit/finish procedure. Implementation details for integration:

- The repository-wide OS file lock releases on process exit; a separate owner record contains PID, checkout, branch and start time. The development-only `fs-native-extensions` dependency supplies cross-platform locking
- Both worktrees are rechecked before main advances; checks cannot be narrowed. The recorded task intent supplies additional coverage selections
- Success returns `integrated: true`, the commit and retained checkout path; `finish` calls cleanup only for its own integrated task
- During the socket-protocol upgrade, bounded older waiters remain protected and a persistent lock file makes older tools refuse integration. Legacy directory locks also remain protected. Never delete a persistent lock file to unlock integration

[Cleanup](../CONTRIBUTING.md#cleanup) owns eligibility, the audit/apply commands and inactivity checks. [The cleanup implementation](worktree-cleanup.mjs) preserves ignored evidence as follows.

Before removal, ignored artifacts (reports, screenshots, logs and other ignored files) are copied to `fauna-worktree-archives/` inside the shared Git directory, with a manifest identifying the original checkout, branch and commit. File bytes, directory entries and symlink targets are compared before the checkout is removed; a mismatch or copy failure preserves it. Root `node_modules` and `dist` are rebuildable and are not archived. Copies request independent filesystem clones where supported, falling back to ordinary copies; later source changes cannot mutate retained evidence. Some newly archived generated evidence expires under the [24-hour policy](../Docs/RESOURCE_EFFICIENCY.md#explicit-maintenance); legacy archives and unclassified artifacts are preserved. Find archives with `git rev-parse --git-common-dir`. Tracked and untracked changes always block removal; cleanup never terminates processes.
