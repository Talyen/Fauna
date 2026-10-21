# Script implementation map

[Contributing](../CONTRIBUTING.md) owns command selection and verification policy; [AGENTS.md](../AGENTS.md) owns authorization and invariants.

| Command or concern                                                               | Implementation owner                                                                                                                                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run worktree -- <task-name> [base-ref]`                                     | [worktree.mjs](worktree.mjs): creates/reuses isolated tasks and links matching dependencies                                                                    |
| `node scripts/integrate.mjs <task-branch>`                                       | [integrate.mjs](integrate.mjs), [Git helpers](lib/git.mjs), [shared lock](lib/integration-lock.mjs), [npm launcher](lib/npm-command.mjs)                       |
| `npm run worktree:cleanup -- [--apply]`                                          | [worktree-cleanup.mjs](worktree-cleanup.mjs): audits or removes clean merged tasks under the shared lock and archives ignored artifacts                        |
| `npm run check`, `npm run verify`                                                | [check.mjs](check.mjs): bounded selected-file formatting and fixed smoke                                                                                       |
| `npm test`                                                                       | [run-local-tests.mjs](run-local-tests.mjs), [local test config](../vitest.local.config.mjs)                                                                    |
| `npm run docs:check`                                                             | [check-docs.mjs](check-docs.mjs), [Markdown helpers](lib/markdown.mjs)                                                                                         |
| `npm run check:bundle`                                                           | [check-bundle-budget.mjs](check-bundle-budget.mjs), [measured allowance](bundle-budget.mjs)                                                                    |
| CI unit/browser failure summaries                                                | [ci-summarize.mjs](ci-summarize.mjs), [workflow](../.github/workflows/ci.yml), [browser reporters](../playwright.config.ts)                                    |
| Architecture and UI source contracts                                             | [boundaries.mjs](boundaries.mjs), [ui-contract.mjs](ui-contract.mjs), [primitive registry](shadcn-registry.json)                                               |
| `npm run preview:task`                                                           | [preview.mjs](preview.mjs): task-owned isolated browser/desktop previews                                                                                       |
| `npm run assets:prepare`, `npm run assets:check`, `npm run assets:check:outputs` | [assets.mjs](assets.mjs); [media contracts](../Docs/CONTENT.md#prepared-assets)                                                                                |
| `npm run content:audit`                                                          | [content-audit.mjs](content-audit.mjs); [pure validator](../src/game/content-validation.ts)                                                                    |
| `npm run balance:playthrough`                                                    | [run-playthrough.mjs](run-playthrough.mjs); [journey runner](../src/application/playthrough.ts)                                                                |
| `npm run audio:review`                                                           | [audio-review.mjs](audio-review.mjs); [tool workflows](../Docs/DEVELOPMENT_TOOLS.md)                                                                           |
| `npm run dev:desktop`                                                            | [dev-desktop.mjs](dev-desktop.mjs)                                                                                                                             |
| `npm run dev`                                                                    | [dev.mjs](dev.mjs): opens the local URL in Safari on macOS, or the default browser on other platforms                                                          |
| `npm run test:desktop`                                                           | [smoke-desktop.mjs](smoke-desktop.mjs)                                                                                                                         |
| Placeholder authoring                                                            | [create-placeholders.mjs](create-placeholders.mjs), [create-location-placeholders.mjs](create-location-placeholders.mjs); [artwork policy](../Docs/CONTENT.md) |

Additional opt-in tools:

- `npm run balance:findings`: [ranked findings](balance-findings.mjs), [analysis and thresholds](lib/balance-findings.mjs); analyzes existing reports without simulations.
- `npm run verify:release-version`, `npm run verify:release`: [read-only release gate](verify-release.mjs), [build identity](lib/release-identity.mjs); no build or publication.
- `npm run generate:patch-notes`: [history filtering and draft generation](generate-patch-notes.mjs); see [release workflow](../Docs/RELEASE.md#release-verification-and-player-notes).
- `npm run balance:compare`: [balance-compare.mjs](balance-compare.mjs), [paired report math](lib/paired-balance.mjs), [production cases](../src/application/balance.ts).
- `npm run perf`, `npm run perf:replay`, `npm run perf:compare`: [capture driver](run-performance.mjs), [metrics](lib/performance-metrics.mjs), [validated fixtures](../src/application/performance.ts).
- `npm run verify:package`: [package gate](verify-package.mjs), [after-pack hardening](../desktop/after-pack.cjs), [packaged renderer launcher](lib/packaged-desktop.mjs).
- `npm run deadcode`: [Knip entrypoints](../knip.config.js); full CI static verification only.
- `npm run context`: [owner lookup](agent-context.mjs).
- `npm run review:status`, `npm run review:diff`: [bounded patch review](agent-review.mjs).
- `npm run test:e2e:route`: [named route launcher](test-route.mjs), [route definitions](lib/test-routes.mjs).
- `npm run test:interactions`: [rendered seeded runner](run-interactions.mjs), [bounded reducer and replay validation](lib/interaction-replay.mjs).
- Shared source identities, report-directory confinement and Node module loading: [tool-runtime.mjs](lib/tool-runtime.mjs).

See [Development tools](../Docs/DEVELOPMENT_TOOLS.md) for scenarios, defaults, evidence and limitations.

Documentation parsing, measured bundle checks, worktree setup, integration safeguards and CI summary patterns are adapted from the sibling Alchemy repository. They have no runtime dependency on that checkout. Fauna retains its own command policy, save rules, worktree cleanup and release identity.

## Bundle allowance

The shared design-system rollout baseline is 613,638 uncompressed JavaScript bytes, measured locally on October 20, 2026 from the implementation based on `6f6d5f1` with verification fixes. This replaces the October 19 artifact baseline of 493,308 bytes, whose producing commit was unknown. The rollout intentionally adds shared shadcn controls, semantic status/talent icons, accessible interaction states and owned combat, hand, reward and navigation presentation. Source-map inspection attributed 88,345 bytes to Fauna UI, with React DOM (174,670 bytes) and the shared primitive/schema libraries remaining the largest dependency costs; no duplicate animation framework is needed. The unused MotionConfig-only dependency was removed. The allowance is now 640 KiB (about 7% headroom), with a warning at 95%. This local working-tree measurement is not hosted CI or release evidence; CI still measures the exact published commit.

The checker sums all JavaScript files recursively and rejects missing or empty entry bundles. Chunk splits do not create extra allowance. Investigate unexpected growth before raising the ceiling; update the measured baseline and reason together when intentional growth needs a new allowance. This gate measures JavaScript size, not artwork downloads, frame pacing or device performance. Run it against an existing build; creating a local build still requires an explicit request.
