# Contributing

[AGENTS.md](AGENTS.md) owns authorization, preservation of unrelated work and gameplay invariants. Use the Node version in `.node-version` and the npm version in `package.json`. Install dependencies with `npm ci` in a standalone checkout; use `npm run deps` in task worktrees.

## Worktrees and integration

From the main checkout, create or reuse this task's isolated checkout:

```sh
npm run worktree -- creature-feedback
# Optional explicit base:
npm run worktree -- creature-feedback <base-ref>
```

Work in the printed directory on its task branch. Setup preserves dirty main and existing task edits. Use `npm run deps` if dependencies are missing or change; never install through a shared dependency link.

Review, verify and commit task-owned changes. From clean main:

```sh
node scripts/integrate.mjs task/creature-feedback
```

Integration holds the shared lock, incorporates current main, verifies the combined result and advances clean main. It reuses a passing check only when its inputs match. Integration waits up to 30 seconds for a busy lock. Dirty main, ambiguous conflicts and unfinished Git operations preserve task work; resolve understood conflicts in the task checkout and retry. Integration and cleanup have separate outcomes; an archival failure preserves the checkout and reports cleanup pending after successful integration. Successful cleanup archives ignored evidence and removes only this task's clean merged checkout and branch. Close task-owned preview processes first.

[Worktree operations](scripts/README.md#worktree-operations) explains dependency sharing, recovery, artifact archives and optional cleanup. Other unfinished tasks do not block completion.

## Verification

Use one entry point in the task checkout:

```sh
npm run review:diff
npm run verify
# Add a regression to the changed-file gate:
npm run verify -- --test tests/unit/game/engine.test.ts
# Inspect coverage without executing:
npm run verify -- --plan
# Diagnose a concrete failure or uncertainty:
npm run verify -- --diagnostic build
```

Review and verification include committed and working changes since the common ancestor with local main on task/ and codex/ branches; elsewhere they select working changes against HEAD. Explicit paths narrow verification. `--base <commit>` selects another base; `--working-tree` selects uncommitted changes. Repeat `--test <suite>` to add regressions without replacing the changed-file gate. Review preserves separate committed, staged and unstaged patches, including reverted edits.

The gate selects changed tests and filename-matched owner suites first, then related suites by import distance within an estimated one-minute budget. Prior task timings refine estimates; unknown suites reserve five seconds. Explicit regressions always run. Selected suites share one worker and one runner with a five-minute deadline. Omissions and unresolved imports are printed; use `--test` for relevant behavior the static graph cannot discover. A passing scoped gate does not establish exhaustive coverage.

Checks cache matching relevant repository inputs, selected coverage, base, runtime, execution environment and installed dependency metadata. Maintained guides and selected Markdown remain check inputs; unrelated notes are included only when the documentation gate runs. Unrelated environment variables do not invalidate checks. Committing unchanged checked files preserves reuse; inputs changing during verification fail the gate. Captures use a separate render-input identity. Reuse establishes no rendered or hosted-CI evidence.

Local completion requires final diff review, a passing gate, any required [rendered evidence](Docs/UI.md#required-review), task-owned commits and protected integration. Report CI pending unless exact-commit results are available. Blocked integration leaves reviewed work committed on its branch. Pushes and publication follow [AGENTS.md](AGENTS.md#worktrees-and-integration).

### Execution and evidence

Task checks, named regressions, documentation checks and focused previews/captures are authorized locally. Run one verification or investigation command at a time per task; use isolated browser profiles and close only owned processes.

`verify -- --diagnostic` accepts `types`, `static`, `build`, `unit <suite files>`, `browser <route>` or `performance <scenario>`. It applies a five-minute deadline and 2 GiB Node heap. Unit diagnostics take one to twelve named suites and one worker. Browser routes are battle, settings, collection, progression and persistence; the launcher owns a free-port production preview. Performance scenarios are battle, swap and menus. Build first if production output is required. Reassess the hypothesis after failure; diagnostics do not authorize repeated exhaustive runs, dependency installation or publication.

Existing `check`, `investigate`, `test:full` and full-CI commands remain compatible. `npm test` retains its fixed smoke default and now accepts named suite paths for bounded unit diagnostics. New task instructions should use `verify`.

Full unit/browser matrices, packaging, coverage and extended performance sweeps remain [hosted-CI](Docs/CI.md) work by default; broader local execution needs an explicit request. Report only actual coverage and relevant unverified platform boundaries.

### Documentation scope

The task check validates maintained Markdown links, anchors, file references, npm examples and reachability when Markdown changes. Link durable guides from an existing owner. Historical records belong under `Docs/archive/` or `Docs/task-evidence/<task>.md`; ignored runtime reports and screenshots belong under `reports/`. Historical records cannot be the sole owner of a current rule. Prefix foreign file references with their repository.

For maintenance details, read [task check implementation](scripts/README.md#task-check-implementation), [test organization and coverage](tests/README.md) or the relevant [script owner](scripts/README.md). These are reference material, not extra steps for ordinary tasks.
