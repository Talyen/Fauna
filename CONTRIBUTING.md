# Contributing

[AGENTS.md](AGENTS.md) owns authorization, preservation of unrelated work and gameplay invariants. Use the Node version in `.node-version` and npm version in `package.json`. Install with `npm ci` in a standalone checkout; use `npm run deps` in task worktrees.

## Worktrees and integration

1. From main, run `npm run worktree -- <task-name>` and work in the printed checkout. An optional second argument selects another base; setup preserves dirty main and existing task edits
2. Implement and inspect `npm run review:diff`. Run focused checks when useful; UI changes also follow the [required review](Docs/UI.md#required-review)
3. Commit task-owned paths, close owned previews and run `npm run finish` from the task checkout. It finds main and reuses recorded extra regression suites; `npm run integrate -- <branch>` remains available from main

Integration incorporates current main, verifies the combined result under the shared lock and advances clean main only after success. This is the required gate; earlier checks are optional and passing results are never cached. Success retains the checkout, branch and evidence, updates the recorded base and clears completed extra-test selections.

A busy lock waits up to 30 seconds; retry without disturbing its owner. Dirty main, unfinished Git operations, failed checks and ambiguous conflicts preserve task work. Resolve understood conflicts in the task checkout and retry. Unrelated unfinished tasks do not block completion. Normal commands prepare dependencies automatically; `npm run deps` repairs them. See [worktree operations](scripts/README.md#worktree-operations) for dependency sharing, lock diagnostics and optional cleanup.

## Verification

| Command                  | Coverage                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `npm run verify:changed` | Changed-file formatting, lint, boundaries, owning compilers and focused contract suites     |
| `npm test -- <suite>`    | Named Vitest unit/DOM suite; without a selector, runs the full set                          |
| `npm run check`          | Full types, lint, formatting, boundaries and unused-code checks                             |
| `npm run test:smoke`     | Fixed lightweight Node smoke set                                                            |
| `npm run verify:full`    | Full static, docs, content, unit, build and browser checks under the execution limits below |

Use `npm run verify:changed -- --plan` to inspect coverage and `npm run verify:changed -- --test <suite>` to add a regression. Required local coverage includes changed tests, filename matches and declared [boundary contracts](scripts/checks/test-owners.json). Extended CI-owned suites select replacement local contracts; full coverage remains in CI. Missing required suites block verification. [Test maintenance](tests/README.md#test-organization) explains the exhaustive lineup matrix.

Local completion requires final diff review, required rendered evidence, task-owned commits and protected integration with its passing gate. If integration is blocked, leave reviewed work committed on its branch. Report CI pending unless exact-commit results are available; CI pending does not block local completion. Pushes and publication follow [AGENTS.md](AGENTS.md#worktrees-and-integration).

### Execution and evidence

Task-required local verification is authorized at any suite breadth, including builds, named tests and focused browser previews/captures. Use isolated profiles and close only owned processes. Run one resource-heavy command at a time, one test worker, at most 2 GiB Node heap and a five-minute deadline per command. Split longer investigations or use [hosted CI](Docs/CI.md); a larger resource budget requires an explicit request.

Ordinary test, static, build, browser-test and verification entrypoints enforce these limits through the shared launcher; nested commands share the outer deadline. CI has its own budgets and parallelism and is the default for packaging and extended matrices. Input fingerprints detect repository changes during checks; captures retain reproducible identities. Report actual checks and relevant unverified platforms; only exact-commit results establish CI completion.

### Advanced selection and diagnostics

Use the [tool selection reference](Docs/DEVELOPMENT_TOOLS.md#task-selection-and-diagnostics) for base overrides, review layers, remembered suites and bounded investigations. Moving or retiring a required suite requires updating the owner registry, including changed/deleted CI-owned entries. `verify` aliases `verify:changed`; `test:full` and `check:full` retain full-suite coverage on every branch.

### Documentation scope

Markdown changes check maintained links, anchors, file references and npm examples across the repository. Reachability from README or AGENTS is advisory. Link durable guides for discovery; historical records belong under `Docs/archive/` or `Docs/task-evidence/<task>.md`, and ignored reports/screenshots under `reports/`. History cannot be the sole owner of a current rule. Prefix foreign file references with their repository.

Keep each rule in its owning guide and link elsewhere. Current guides explain behavior and procedure; dated records retain source identity, observations and limitations. Prefer source links for catalog values and one evidence-scope block per record, retaining differences between attempts. Preserve historical decisions and evidence when shortening prose.

See [script owners](scripts/README.md) and [test maintenance](tests/README.md) when changing their infrastructure.
