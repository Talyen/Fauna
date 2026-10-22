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

Integration holds the shared lock, incorporates current main, verifies the combined result and advances clean main. It reuses a passing check only when its inputs match. Busy locks, dirty main, ambiguous conflicts and unfinished Git operations preserve task work; resolve understood conflicts in the task checkout and retry. Successful integration archives ignored evidence and removes only this task's clean merged checkout and branch. Close task-owned preview processes first.

[Worktree operations](scripts/README.md#worktree-operations) explains dependency sharing, recovery, artifact archives and optional cleanup. Other unfinished tasks do not block completion.

## Verification

In the task checkout:

```sh
npm run review:diff
npm run check
# Show selected coverage without executing checks:
npm run check -- --plan
```

On task/ and codex/ branches, these commands include committed and working changes since the common ancestor with local main. On main, other branches and detached checkouts, they select working changes against HEAD. Use `--base <commit>` for another base or `--working-tree` for uncommitted changes only; `--diff` retains the working-tree alias. Explicit paths narrow the selection. Review preserves separate committed, staged and unstaged patches, including reverted edits. The check prints omissions; add a named regression suite if the selection misses affected behavior.

`npm run verify` aliases `check`. Passing checks are recorded locally per worktree and reused only for matching source bytes, file selection, base, Node runtime, environment and installed dependency metadata. Committing unchanged checked files preserves reuse. Changes during verification fail the gate. A reused result establishes no rendered or hosted-CI evidence.

Local completion requires reviewing the final diff, passing the task check, inspecting any required [rendered evidence](Docs/UI.md#required-review), committing task-owned work and protected integration. Report CI as pending unless exact-commit results are available. A blocked integration leaves reviewed work committed on its branch. Pushes and publication follow [AGENTS.md](AGENTS.md#worktrees-and-integration).

### Execution and evidence

Task checks, named regression suites, documentation checks and focused previews/captures are authorized locally. Run one verification or investigation command at a time per task; use isolated browser profiles and close only owned processes.

For a concrete task failure or uncertainty that the ordinary gate cannot resolve, bounded broader diagnostics are also authorized:

```sh
npm run investigate -- types
npm run investigate -- static
npm run investigate -- build
npm run investigate -- unit tests/unit/game/engine.test.ts
npm run investigate -- browser battle
npm run investigate -- performance battle
```

The launcher allows one command with a five-minute deadline and 2 GiB Node heap. Unit diagnostics require one to twelve named suites and use one worker; browser diagnostics select an existing route with one worker on an owned free-port production preview; performance selects one existing scenario. Build first when the selected browser/performance tool requires production output. Use only diagnostics directly relevant to the task and reassess the hypothesis after failure; this allowance does not authorize repeated exhaustive runs. The diagnostic commands never install dependencies or publish anything.

Full unit/browser matrices, packaging, coverage and extended performance sweeps remain [hosted-CI](Docs/CI.md) work by default; broader local execution needs an explicit request. Local checks, preview captures and diagnostic runs establish only their actual coverage. Report relevant unverified platform boundaries.

### Documentation scope

The task check validates maintained Markdown links, anchors, file references, npm examples and reachability when Markdown changes. Link durable guides from an existing owner. Historical records belong under `Docs/archive/` or `Docs/task-evidence/<task>.md`; ignored runtime reports and screenshots belong under `reports/`. Historical records cannot be the sole owner of a current rule. Prefix foreign file references with their repository.

For maintenance details, read [task check implementation](scripts/README.md#task-check-implementation), [test organization and coverage](tests/README.md) or the relevant [script owner](scripts/README.md). These are reference material, not extra steps for ordinary tasks.
