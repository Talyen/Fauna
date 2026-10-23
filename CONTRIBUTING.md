# Contributing

[AGENTS.md](AGENTS.md) owns authorization, preservation of unrelated work and gameplay invariants. Use the Node version in `.node-version` and the npm version in `package.json`. Install dependencies with `npm ci` in a standalone checkout; use `npm run deps` in task worktrees.

## Worktrees and integration

1. From main, run `npm run worktree -- <task-name>` and work in the printed checkout. An optional second argument selects another base. Setup preserves dirty main and existing task edits
2. Implement the task and inspect `npm run review:diff`. For UI work, follow the [UI task procedure](Docs/UI.md#required-review). Run focused checks during development when useful
3. Commit task-owned paths. Close task-owned preview processes. Run `npm run finish` from the task checkout; it finds main and reuses recorded extra regression suites. `npm run integrate -- <branch>` remains available from main

Integration incorporates current main, verifies the combined result under the shared lock and advances clean main only after success. No separate pre-integration gate is required; early checks are optional and results are never cached. It retains the task checkout, branch and evidence, updates the recorded base and clears completed extra-test selections.

A busy lock waits up to 30 seconds; retry without disturbing its owner. Dirty main, unfinished Git operations, failed checks and ambiguous conflicts preserve task work. Resolve understood conflicts in the task checkout and retry. [Worktree operations](scripts/README.md#worktree-operations) explains dependency sharing, lock diagnostics and optional cleanup; unrelated unfinished tasks do not block completion. Normal commands prepare dependencies automatically; `npm run deps` repairs them safely.

## Verification

Choose the command by coverage:

| Command                  | Coverage                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `npm run verify:changed` | Changed-file formatting, lint, boundaries, owning compilers and focused contract suites             |
| `npm test -- <suite>`    | Vitest unit/DOM tests for the named suite; without a suite, the full unit/DOM set                   |
| `npm run check`          | Full static checks: types, lint, formatting, boundaries and unused code                             |
| `npm run test:smoke`     | Fixed lightweight Node smoke set                                                                    |
| `npm run verify:full`    | Full static, docs, content, unit, build and browser checks; extended execution policy below applies |

`npm run verify` remains a compatibility alias for `verify:changed`. `test:full` and `check:full` retain their full-suite meanings. Test and static commands have the same scope on every branch.

Worktree creation records the chosen base commit in worktree-local Git metadata. Verification, context and review use it across commits and branch renames. Unregistered non-main branches and detached checkouts use their common ancestor with local main, regardless of branch name; main defaults to HEAD. Empty selections explicitly report that nothing was checked or reviewed. Explicit paths narrow selection, `--base <commit>` changes the base, and `--working-tree` selects only uncommitted changes. Review shows the net task change by default; `--layers` exposes committed, staged and unstaged patches, including reverted edits.

```sh
npm run verify:changed -- --plan
npm run verify:changed -- --test tests/unit/game/engine.test.ts
# Explore import-related suites only when investigating a coverage question:
npm run verify:changed -- --plan --related
# Bounded diagnostic for a concrete failure:
npm run verify:changed -- --diagnostic build
```

The required local set consists of changed tests, filename-matched tests and the nearest declared [boundary contracts](scripts/checks/test-owners.json). Each boundary records why its small suite set is required. An exact suite entry with `tier: "ci"` assigns an extended simulation to full CI and declares its replacement local contracts. Automatic selection reports that suite as CI-owned while still formatting, linting and compiling changed files. The exhaustive ordinary-lineup matrix uses this tier; local engine contracts retain fixed representative lineups with the same journey assertions. `npm test` and `test:full` always retain the complete matrix on every branch and environment.

Missing required suites, including a changed or deleted CI-owned suite, block verification rather than silently reducing coverage; update the registry when moving or retiring a suite. Import-graph suggestions are opt-in with `--related`; they never displace required or explicitly added suites. Add task-specific regressions with `--test`; an explicit request also runs a CI-owned suite locally within the ordinary resource limits. Actual verification remembers those selections, including failed attempts, for the final combined check. `--plan` never changes intent. Remove an obsolete selection with `--forget-test <suite>`. Only the base and selected suite paths are stored; no passing result is reused. Full coverage remains in CI.

Local completion requires final diff review, any required rendered evidence, task-owned commits and protected integration with its passing gate. Report CI pending unless exact-commit results are available. Blocked integration leaves reviewed work committed on its branch. Pushes and publication follow [AGENTS.md](AGENTS.md#worktrees-and-integration).

### Execution and evidence

Local verification needed for the task is authorized regardless of suite breadth, including builds, named tests and focused browser previews/captures. Use isolated profiles and close only owned processes. Run one resource-heavy command at a time, one test worker, at most 2 GiB Node heap and a five-minute deadline per command. Split longer investigations or use [hosted CI](Docs/CI.md); a larger resource budget requires an explicit request.

Ordinary test, static, build, browser-test and verification entrypoints enforce these limits through the shared launcher; nested commands share the outer deadline. `verify:changed -- --diagnostic <mode>` offers [bounded investigations](scripts/README.md#task-check-implementation). CI keeps its own budgets/parallelism and remains the default for packaging and extended matrices.

Input fingerprints detect repository changes during checks; captures retain reproducible identities and no passing result is cached. CI pending does not block local completion. Report actual checks and relevant unverified platforms; only exact-commit results establish CI completion.

### Documentation scope

Markdown changes check maintained links, anchors, file references and npm examples across the repository. Reachability from README or AGENTS is advisory and never blocks a task. Link durable guides where useful for discovery. Historical records belong under `Docs/archive/` or `Docs/task-evidence/<task>.md`; ignored runtime reports and screenshots belong under `reports/`. Historical records cannot be the sole owner of a current rule. Prefix foreign file references with their repository.

Keep each rule in its owning guide; link to it elsewhere. Current guides explain behavior and procedure; dated records retain source identity, observations and limitations. Prefer source links for catalog values and one evidence-scope block per record, retaining any differences between attempts. Preserve historical decisions and evidence when shortening prose.

See [script owners](scripts/README.md) and [test maintenance](tests/README.md) when changing their infrastructure.
