# Contributing

[AGENTS.md](AGENTS.md) owns authorization, preservation of unrelated work and gameplay invariants. Use the Node version in `.node-version` and npm version in `package.json`. Install with `npm ci` in a standalone checkout; use `npm run deps` in task worktrees.

## Worktrees and integration

1. From main, run `npm run worktree -- <task-name>` and work in the printed checkout. An optional second argument selects another base; setup preserves dirty main and existing task edits
2. Implement and inspect `npm run review:diff`. Run focused checks when useful; UI changes also follow the [required review](Docs/UI.md#required-review)
3. Commit task-owned paths, close owned previews and run `npm run finish` from the task checkout. It finds main and includes recorded regression coverage in its plan; `npm run integrate -- <branch>` remains available from main

Integration incorporates current main, verifies the combined result under the shared lock and advances clean main only after success. This is the required gate; earlier checks are optional and passing results are never cached. Success retains the checkout, branch and evidence, updates the recorded base and clears completed extra-test selections.

A busy lock waits up to 30 seconds; retry without disturbing its owner. Dirty main, unfinished Git operations, failed checks and ambiguous conflicts preserve task work. Resolve understood conflicts in the task checkout and retry. Unrelated unfinished tasks do not block completion. Routine commands reuse matching installed dependencies and stop if they are missing or stale; `npm run deps` prepares them separately. See [worktree operations](scripts/README.md#worktree-operations) for dependency sharing, lock diagnostics and optional cleanup.

## Verification

| Command                                | Coverage                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:changed`               | Changed-file formatting, syntax lint, source boundaries and documentation contracts; plans CI compiler/test coverage without running it |
| `npm test`                             | Optional fixed lightweight Node smoke set; same as `npm run test:smoke`                                                                 |
| `npm test -- <suite>`                  | One exact existing unit/integration suite, one worker, 1 GiB heap and a 30-second command deadline                                      |
| `npm run check` / `npm run check:full` | Full static checks; CI-owned, blocked locally by default                                                                                |
| `npm run test:full`                    | Complete unit/DOM/exhaustive discovery; CI-owned, blocked locally by default                                                            |
| `npm run verify:full`                  | Full static, docs, content, unit, build and browser coverage; CI-owned, blocked locally by default                                      |

Use `npm run verify:changed -- --plan` to inspect coverage and `--test <suite>` to record a regression in the plan. Changed tests, filename matches and declared [boundary contracts](scripts/checks/test-owners.json) identify coverage; missing required suites still block verification. These suites and owning compilers are deferred to hosted CI, including remembered selections during integration. The gate never launches automatic smoke or test suites. Run one specific regression separately when useful; append `-t <test-name>` to narrow that suite further; do not loop over the plan's suites locally. [Test maintenance](tests/README.md#test-organization) explains the exhaustive lineup matrix.

Local completion requires final diff review, required rendered evidence, task-owned commits and protected integration with its passing gate. If integration is blocked, leave reviewed work committed on its branch. Report CI pending unless exact-commit results are available; CI pending does not block local completion. Pushes and publication follow [AGENTS.md](AGENTS.md#worktrees-and-integration).

### Execution and evidence

Hosted CI is the default for full/static/type-aware checks, broad unit/DOM suites, exhaustive simulations, builds, browser/desktop tests, packaging and performance captures. Do not run these locally just because they are task-related, an agent wants more confidence, a command is guarded or CI has not run. CI pending remains an explicit verification boundary and does not block local integration.

The shared launcher refuses expensive entrypoints before dependency setup or test/build startup. Routine verification also refuses implicit dependency installs; run `npm run deps` separately when needed. Only an explicit user request for heavy local execution authorizes `FAUNA_LOCAL_HEAVY=1` on that command. Do not set it automatically, set `CI=true` locally, invoke underlying binaries/scripts to bypass the policy, or split a broad run into many individual suites. On macOS, opted-in launcher commands automatically acquire the shared host admission helper before dependency setup. Busy or missing admission returns 75 without starting work; nested recipes reuse admission. The helper defaults to `~/Developer/.coordination/heavy_lane.py` and `CODEX_HEAVY_LANE_HELPER` can select its existing location. Only hosted `GITHUB_ACTIONS=true` bypasses local admission and budgets; `CI=true` alone does not. Integration remains lightweight and never takes the heavy lane. The opt-in retains full command coverage; hosted CI runs those same commands with its own budgets and parallelism.

Routine local checks and one exact regression use one worker, at most 1 GiB Node heap and a 30-second command deadline; the optional smoke set uses 512 MiB. Stop on the deadline and defer further coverage to CI. Explicitly authorized heavy local work uses one command at a time, one worker, at most 2 GiB heap and a five-minute deadline. Integration allows five minutes for locking and its lightweight gate. A larger local budget requires an explicit user request.

Focused visual preview/capture required by [UI review](Docs/UI.md#required-review) remains authorized, using the development preview without a production build where possible. That exception does not authorize browser suites or performance matrices. Use isolated profiles and close only owned processes. Input fingerprints detect repository changes during checks; captures retain reproducible identities. Report actual checks and relevant unverified platforms; only exact-commit results establish CI completion.

### Advanced selection and diagnostics

Use the [tool selection reference](Docs/DEVELOPMENT_TOOLS.md#task-selection-and-diagnostics) for base overrides, review layers, remembered suites and bounded investigations. Moving or retiring a required suite requires updating the owner registry, including changed/deleted CI-owned entries. `verify` aliases `verify:changed`; `test:full` and `check:full` retain full-suite coverage on every branch when run in CI or with the explicit local opt-in.

### Documentation scope

Markdown changes check maintained links, anchors, file references and npm examples across the repository. Reachability from README or AGENTS is advisory. Link durable guides for discovery; historical records belong under `Docs/archive/` or `Docs/task-evidence/<task>.md`, and ignored reports/screenshots under `reports/`. History cannot be the sole owner of a current rule. Prefix foreign file references with their repository.

Keep each rule in its owning guide and link elsewhere. Current guides explain behavior and procedure; dated records retain source identity, observations and limitations. Prefer source links for catalog values and one evidence-scope block per record, retaining differences between attempts. Preserve historical decisions and evidence when shortening prose.

See [script owners](scripts/README.md) and [test maintenance](tests/README.md) when changing their infrastructure.
