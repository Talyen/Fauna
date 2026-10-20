# Script implementation map

[Contributing](../CONTRIBUTING.md) owns command selection and verification policy; [AGENTS.md](../AGENTS.md) owns authorization and invariants.

| Command or concern                                                               | Implementation owner                                                                                                                                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run worktree -- <task-name> [base-ref]`                                     | [worktree.mjs](worktree.mjs): creates/reuses isolated tasks and links matching dependencies                                                                    |
| `node scripts/integrate.mjs <task-branch>`                                       | [integrate.mjs](integrate.mjs), [Git helpers](lib/git.mjs), [shared lock](lib/integration-lock.mjs), [npm launcher](lib/npm-command.mjs)                       |
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
| `npm run test:desktop`                                                           | [smoke-desktop.mjs](smoke-desktop.mjs)                                                                                                                         |
| Placeholder authoring                                                            | [create-placeholders.mjs](create-placeholders.mjs), [create-location-placeholders.mjs](create-location-placeholders.mjs); [artwork policy](../Docs/CONTENT.md) |

Additional opt-in tools:

- `npm run balance:compare`: [balance-compare.mjs](balance-compare.mjs), [paired report math](lib/paired-balance.mjs), [production cases](../src/application/balance.ts).
- `npm run perf`, `npm run perf:replay`, `npm run perf:compare`: [capture driver](run-performance.mjs), [metrics](lib/performance-metrics.mjs), [validated fixtures](../src/application/performance.ts).
- `npm run verify:package`: [package gate](verify-package.mjs).
- `npm run context`: [owner lookup](agent-context.mjs).
- `npm run review:status`, `npm run review:diff`: [bounded patch review](agent-review.mjs).
- Shared source identities, report-directory confinement and Node module loading: [tool-runtime.mjs](lib/tool-runtime.mjs).

See [Development tools](../Docs/DEVELOPMENT_TOOLS.md) for scenarios, defaults, evidence and limitations.

Documentation parsing, measured bundle checks, worktree setup, integration safeguards and CI summary patterns are adapted from the sibling Alchemy repository. They have no runtime dependency on that checkout. Fauna retains its own command policy, save rules, worktree retention and release identity.

## Bundle allowance

The initial baseline is 493,308 uncompressed JavaScript bytes from the existing Fauna artifact `index-S35CAMBQ.js`, dated October 19, 2026, SHA-256 `10d32410df66f8e04cc970f9c208a2a55a46bff626a80b5009ff28f11e60533e`. Its producing commit was not recorded, so this is an initial artifact baseline, not exact-current-commit build evidence. The allowance is 580 KiB (about 20% headroom), with a warning at 95%. The next CI build measures the exact task commit.

The checker sums all JavaScript files recursively and rejects missing or empty entry bundles. Chunk splits do not create extra allowance. Investigate unexpected growth before raising the ceiling; update the measured baseline and reason together when intentional growth needs a new allowance. This gate measures JavaScript size, not artwork downloads, frame pacing or device performance. Run it against an existing build; creating a local build still requires an explicit request.
