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

Integration holds the shared lock, incorporates current main, verifies the combined result and advances clean main. It always checks the combined result; earlier task checks are not cached. Integration waits up to 30 seconds for a busy lock. Dirty main, ambiguous conflicts and unfinished Git operations preserve task work; resolve understood conflicts in the task checkout and retry. Integration and cleanup have separate outcomes; an archival failure preserves the checkout and reports cleanup pending after successful integration. Successful cleanup archives ignored evidence and removes only this task's clean merged checkout and branch. Close task-owned preview processes first.

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

The gate runs changed tests, filename-matched suites and the nearest declared [owner suites](scripts/checks/test-owners.json). This selection is deterministic and does not depend on timing reports. Related suites found through imports are suggestions; add relevant behavior with `--test`. The plan lists required suites, suggestions and unresolved imports. Full coverage remains in CI.

Every invocation executes its checks. Input fingerprints detect repository changes during a run; they do not cache passing results or scan installed dependency trees. Captures retain a separate identity for reproducible comparisons.

Local completion requires final diff review, a passing gate, any required [rendered evidence](Docs/UI.md#required-review), task-owned commits and protected integration. Report CI pending unless exact-commit results are available. Blocked integration leaves reviewed work committed on its branch. Pushes and publication follow [AGENTS.md](AGENTS.md#worktrees-and-integration).

### Execution and evidence

Focused verification and investigation needed for the task are authorized locally, including builds, named test suites and browser previews/captures. Use isolated profiles, run resource-heavy checks sequentially and close only owned processes. Use `npm run deps` when task dependencies are missing or change.

Use `npm run verify -- --diagnostic <mode>` for types, static checks, a build, named unit suites, a named browser route or a performance scenario. The launcher validates scope and enforces resource limits; [implementation details](scripts/README.md#task-check-implementation) are reference material. Reassess the hypothesis after a failure.

`npm test` and `npm run check` are aliases of `verify`, including its selection options. `npm run test:smoke` explicitly runs the fixed smoke set. Existing diagnostic and full-suite commands remain available; ordinary task instructions use `verify`.

Full test matrices, packaging, coverage and extended performance sweeps run in [hosted CI](Docs/CI.md) by default. Broader local execution needs an explicit request. CI pending does not block local completion; report actual coverage and relevant unverified platforms.

### Documentation scope

The task check validates maintained Markdown links, anchors, file references, npm examples and reachability when Markdown changes. Link durable guides from an existing owner. Historical records belong under `Docs/archive/` or `Docs/task-evidence/<task>.md`; ignored runtime reports and screenshots belong under `reports/`. Historical records cannot be the sole owner of a current rule. Prefix foreign file references with their repository.

For maintenance details, read [task check implementation](scripts/README.md#task-check-implementation), [test organization and coverage](tests/README.md) or the relevant [script owner](scripts/README.md). These are reference material, not extra steps for ordinary tasks.
