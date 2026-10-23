# Contributing

[AGENTS.md](AGENTS.md) owns authorization, preservation of unrelated work and gameplay invariants. Use the Node version in `.node-version` and the npm version in `package.json`. Install dependencies with `npm ci` in a standalone checkout; use `npm run deps` in task worktrees.

## Worktrees and integration

1. From main, run `npm run worktree -- <task-name>` and work in the printed checkout. An optional second argument selects another base. Setup preserves dirty main and existing task edits
2. Implement the task and inspect `npm run review:diff`. For UI work, follow the [UI task procedure](Docs/UI.md#required-review). Run focused checks during development when useful
3. Commit task-owned paths. Close task-owned preview processes. From clean main, run `npm run integrate -- task/<task-name>`; add `--test <suite>` for any task-specific regression beyond the declared contracts

Integration is the single required final local gate. It holds the shared lock, incorporates current main, verifies the combined result and advances clean main only after success. A separate full changed-file check immediately before integration is unnecessary. Early checks are optional diagnostics; results are not cached. This avoids both duplicate required gates and persistent cache invalidation machinery.

A busy lock waits up to 30 seconds; retry after its bounded wait without disturbing the owner. Dirty main, unfinished Git operations, failed checks and ambiguous conflicts preserve task work. Resolve understood conflicts in the task checkout and retry. Integration retains the task checkout, branch and evidence at their original paths. Optional cleanup is a separate operation that archives ignored evidence before removing eligible clean merged tasks. Other unfinished tasks do not block completion.

[Worktree operations](scripts/README.md#worktree-operations) covers dependency sharing, recovery, archives and optional cleanup. Use `npm run deps` when task dependencies are missing or change; never install through a shared dependency link.

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

Changed-file verification and review include committed and working changes since the common ancestor with local main on task/ and codex/ branches; elsewhere they select working changes against HEAD. A clean selection reports no changed files and executes no checks. Explicit paths narrow selection, `--base <commit>` changes the base, and `--working-tree` selects only uncommitted changes. Review retains committed, staged and unstaged patches, including reverted edits.

```sh
npm run verify:changed -- --plan
npm run verify:changed -- --test tests/unit/game/engine.test.ts
# Explore import-related suites only when investigating a coverage question:
npm run verify:changed -- --plan --related
# Bounded diagnostic for a concrete failure:
npm run verify:changed -- --diagnostic build
```

The required set consists of changed tests, filename-matched tests and the nearest declared [boundary contracts](scripts/checks/test-owners.json). Each boundary records why its small suite set is required. Import-graph suggestions are opt-in with `--related`; they never displace required or explicitly added suites. Add task-specific regressions with `--test`; pass those suites to integration for the final combined check. Full coverage remains in CI.

Local completion requires final diff review, any required rendered evidence, task-owned commits and protected integration with its passing gate. Report CI pending unless exact-commit results are available. Blocked integration leaves reviewed work committed on its branch. Pushes and publication follow [AGENTS.md](AGENTS.md#worktrees-and-integration).

### Execution and evidence

Focused verification and investigation needed for the task are authorized locally, including builds, named test suites and browser previews/captures. Use isolated profiles, run resource-heavy checks sequentially and close only owned processes. `verify:changed -- --diagnostic <mode>` bounds types, static checks, builds, named unit suites, browser routes and performance scenarios; [implementation details](scripts/README.md#task-check-implementation) are reference material.

Local verification needed for the task is authorized regardless of suite breadth. Run one resource-heavy command at a time, use one test worker, cap Node heap at 2 GiB and give each command a five-minute deadline; split longer investigations or use [hosted CI](Docs/CI.md). The diagnostic launcher enforces these limits, including `--diagnostic unit` for the full unit/DOM suite. A larger resource budget needs an explicit request; choosing more relevant tests within that budget does not. Hosted CI remains the default for packaging and extended matrices. CI pending does not block local completion; report actual coverage and relevant unverified platforms. Input fingerprints detect repository changes during checks; captures retain their own reproducible identity. No check result is cached.

### Documentation scope

Markdown changes check maintained links, anchors, file references and npm examples across the repository. Reachability from README or AGENTS is advisory and never blocks a task. Link durable guides where useful for discovery. Historical records belong under `Docs/archive/` or `Docs/task-evidence/<task>.md`; ignored runtime reports and screenshots belong under `reports/`. Historical records cannot be the sole owner of a current rule. Prefix foreign file references with their repository.

For maintenance details, see [script owners](scripts/README.md) or [test maintenance](tests/README.md). These are references, not extra steps for ordinary tasks.
