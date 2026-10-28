# Contributing

[AGENTS.md](AGENTS.md) owns authorization, preservation of unrelated work and gameplay invariants. Use the Node version in `.node-version` and npm version in `package.json`. Install with `npm ci` in a standalone checkout; use `npm run deps` in task worktrees.

## Worktrees and integration

1. From main, run `npm run worktree -- <task-name>` and work in the printed checkout. An optional second argument selects another base; setup preserves dirty main and existing task edits
2. Run `npm run task:status` for the checkout, changed paths and next steps. Implement and inspect `npm run review:diff`. Run focused checks when useful; UI changes also follow the [required review](Docs/UI.md#required-review)
3. Commit task-owned paths, close owned previews and run `npm run finish` from the task checkout. It finds main and includes recorded regression coverage in its plan; `npm run integrate -- <branch>` remains available from main

`task:status` reports separate local gate, focused regression, visual review and hosted CI states. A local receipt identifies the committed and working source observed before and after the command; a changed source, missing receipt or unreadable source is unknown. A focused command's zero exit is not proof that a filtered test ran; check its test count in the output. Receipts are advisory, never a substitute for the integration gate. After inspecting a complete current-source capture, `npm run task:status -- --record-visual <capture-evidence.json>` records that manual review; it checks source identity and capture files but cannot perform the inspection. Record exercised interactions and limitations in the handoff. Use `--ci` for the exact committed SHA; see [hosted task verification](Docs/CI.md#hosted-task-verification) when the commit has not been published.

Integration incorporates current main, verifies the combined result under the shared lock and advances clean main only after success. This is the required gate; earlier checks are optional and passing results are never cached. Integration retains the checkout, branch and evidence, updates the recorded base and clears completed extra-test selections. `finish` then archives ignored evidence and removes only the calling completed checkout, retaining its branch; use `-- --keep-worktree` while follow-up work still needs it. Some newly archived generated evidence expires after 24 hours unless retained; see [resource efficiency](Docs/RESOURCE_EFFICIENCY.md#explicit-maintenance).

If integration succeeds but retirement fails, the checkout and branch remain. Resolve the reported issue, close owned previews, then run `npm run finish -- --retry-cleanup` from that task checkout. This retries only retirement, without reintegration; it rechecks that the task is clean, unlocked and merged. Do not use it while the checkout is still needed.

A busy lock waits up to 30 seconds; retry without disturbing its owner. Dirty main, unfinished Git operations, failed checks and ambiguous conflicts preserve task work. Resolve understood conflicts in the task checkout and retry. Unrelated unfinished tasks do not block completion. Routine commands reuse matching installed dependencies and stop if they are missing or stale; `npm run deps` prepares them separately. See [dependencies and source assets](#dependencies-and-source-assets), [cleanup](#cleanup) and [lock diagnostics](scripts/README.md#worktree-operations).

### Dependencies and source assets

Task creation uses `.worktrees/<task-name>` on `task/<task-name>` from committed local main. Matching checkouts are reused without resets; conflicting directories or branches are preserved and rejected. Dependencies are shared only when manifests, install settings and lifecycle scripts match. When dependencies are missing or change, run `npm run deps` in the task: it reconnects a missing matching shared install or detaches only a mismatched link before `npm ci`, using the pinned npm. Never run `npm ci` through a shared dependency link. Ordinary task-command edits do not invalidate an install.

New tasks use code-only checkouts only when the target revision passes the storage helper's compatibility markers for committed prepared media and output-only checks; otherwise they retain full assets. Check the printed `Storage:` result rather than assuming source assets were omitted. Code-only checkouts omit `public/art/`, `public/ui/` and `assets/source/`, retaining prepared media, manifests, code and tests. For source-asset work use `npm run worktree -- <task-name> --full-assets`, or run `git sparse-checkout disable` in an existing task before preparation, source checks or art review. Missing-source preparation preserves published outputs and prints this instruction. [Storage internals](scripts/README.md#worktree-operations) explain cloning and dependency checks.

### Cleanup

Close owned previews before retiring a task. Integration itself performs no sweep.

For optional repository maintenance from clean main:

```sh
npm run worktree:cleanup
npm run worktree:cleanup -- --apply
```

The first command audits; `--apply` removes only eligible merged local `task/` or `codex/` branches/checkouts under the integration lock. Confirm inactivity first: clean/merged status or age alone does not establish it. Dirty, unmerged, locked and unfinished work is preserved. Cleanup never merges work, deletes remote branches, forces removal or stops processes. Preserved tasks do not fail the sweep; operational failures do. Ignored evidence is archived before removal; [archive details](scripts/README.md#worktree-operations) locate retained copies and manifests.

## Verification

| Command                                | Coverage                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:changed`               | Changed-file formatting, syntax lint, source boundaries and documentation contracts; plans CI compiler/test coverage without running it |
| `npm test`                             | Optional fixed lightweight Node smoke set; same as `npm run test:smoke`                                                                 |
| `npm test -- <suite>`                  | One exact existing unit/integration suite, one worker, 1 GiB heap and a 30-second command deadline                                      |
| `npm run check` / `npm run check:full` | Full static checks; CI-owned, blocked locally by default                                                                                |
| `npm run test:full`                    | Complete unit/DOM/exhaustive discovery; CI-owned, blocked locally by default                                                            |
| `npm run verify:full`                  | Full static, docs, content, unit, build and browser coverage; CI-owned, blocked locally by default                                      |

Use `npm run verify:changed -- --plan` to inspect coverage and `--record-test <suite>` to record a regression in the plan (`--test` remains an alias). `npm run finish -- --test <suite>` also records extra coverage for its integration plan. Changed tests, filename matches and declared [boundary contracts](scripts/checks/test-owners.json) identify coverage; missing required suites still block verification. These suites and owning compilers are deferred to hosted CI, including remembered selections during integration. The gate never launches automatic smoke or test suites. Run one specific regression separately when useful; append `-t <test-name>` to narrow that suite further; do not loop over the plan's suites locally. [Test maintenance](tests/README.md#test-organization) explains the exhaustive lineup matrix.

Local completion requires final diff review, required rendered evidence, task-owned commits and protected integration with its passing gate. If integration is blocked, leave reviewed work committed on its branch. Use `npm run task:status -- --ci` to check the latest hosted run and final `verify` job for the exact committed SHA; uncommitted changes are never covered. A missing or unavailable run is not a pass. Report CI pending unless exact-commit results are available; CI pending does not block local completion. Pushes and publication follow [AGENTS.md](AGENTS.md#worktrees-and-integration).

### Execution and evidence

Hosted CI is the default for full/static/type-aware checks, broad unit/DOM suites, exhaustive simulations, builds, browser/desktop tests, packaging and performance captures. Do not run these locally just because they are task-related, an agent wants more confidence, a command is guarded or CI has not run. CI pending remains an explicit verification boundary and does not block local integration.

The shared launcher refuses expensive entrypoints before dependency setup or test/build startup. Routine verification also refuses implicit dependency installs; run `npm run deps` separately when needed. Only an explicit user request for heavy local execution authorizes `FAUNA_LOCAL_HEAVY=1` on that command. Do not set it automatically, set `CI=true` locally, invoke underlying binaries/scripts to bypass the policy, or split a broad run into many individual suites. On macOS, opted-in launcher commands join the shared host admission queue for up to 15 minutes before dependency setup. A queue timeout or missing helper returns 75 without starting work; nested recipes reuse admission. The helper defaults to `~/Developer/.coordination/heavy_lane.py` and `CODEX_HEAVY_LANE_HELPER` can select its existing location. Hosted `GITHUB_ACTIONS=true` bypasses local admission and budgets; Vercel hosted builds (`VERCEL=1`) do so only for `check:types` and `build`; `CI=true` alone does not. Integration remains lightweight and never takes the heavy lane. The opt-in retains full command coverage; hosted CI runs those same commands with its own budgets and parallelism.

The changed-file gate has a 90-second command deadline; one exact regression and the optional smoke set retain a 30-second deadline. Routine checks use one worker and at most 1 GiB Node heap; the smoke set uses 512 MiB. Retry timed-out checks when useful, and investigate before changing their scope or limits. Explicitly authorized heavy local work uses one command at a time, one worker, at most 2 GiB heap and a five-minute deadline. Integration has a five-minute outer command deadline, including a lock wait of at most 30 seconds and its lightweight gate. A larger local execution budget requires an explicit user request.

Focused visual preview/capture required by [UI review](Docs/UI.md#required-review) remains authorized, using the development preview without a production build where possible. That exception does not authorize browser suites or performance matrices. Use isolated profiles and close only owned processes. Input fingerprints detect repository changes during checks; captures retain reproducible identities. Report actual checks and relevant unverified platforms; only exact-commit results establish CI completion.

On this Mac, wrap the outermost capture or rendered inspection command with `python3 /Users/ryanmcintire/Developer/.coordination/heavy_lane.py --owner "$CODEX_THREAD_ID" --wait 900 --timeout 300 -- <command>`; `npm run ui:guide -- <small|interaction|layout> <scenario>` prints wrapped capture commands. Start persistent preview servers outside the bounded wrapper, then perform rendered inspection within its lease and close only owned processes. See `/Users/ryanmcintire/Developer/.coordination/README.md` for admission and recovery.

### Advanced selection and diagnostics

Use the [tool selection reference](Docs/DEVELOPMENT_TOOLS.md#task-selection-and-diagnostics) for base overrides, review layers, remembered suites and bounded investigations. Moving or retiring a required suite requires updating the owner registry, including changed/deleted CI-owned entries. `verify` aliases `verify:changed`; `test:full` and `check:full` retain full-suite coverage on every branch when run in CI or with the explicit local opt-in.

### Documentation scope

Markdown changes check maintained links, anchors, file references and npm examples across the repository. Reachability from README or AGENTS is advisory. Link durable guides for discovery; historical records belong under `Docs/archive/` or `Docs/task-evidence/<task>.md`, and ignored reports/screenshots under `reports/`. History cannot be the sole owner of a current rule. Prefix foreign file references with their repository.

Keep each rule in its owning guide and link elsewhere. Current guides explain behavior and procedure; dated records retain source identity, observations and limitations. Prefer source links for catalog values and one evidence-scope block per record, retaining differences between attempts. Preserve historical decisions and evidence when shortening prose.

See [script owners](scripts/README.md) and [test maintenance](tests/README.md) when changing their infrastructure.
