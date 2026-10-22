# Contributing

[AGENTS.md](AGENTS.md) owns scope, Git authorization, preservation of unrelated work, and gameplay invariants. [Scripts](scripts/README.md) maps commands to their implementation. Use Node 24 and npm 11+, and install dependencies with `npm ci`.

## Worktrees and integration

Create or reuse this task's isolated checkout from the main checkout:

```sh
npm run worktree -- creature-feedback
# Optional explicit base:
npm run worktree -- creature-feedback <base-ref>
```

The command creates `.worktrees/<task-name>` on `task/<task-name>` from committed local main by default. An existing matching checkout is reused without resetting files. Existing branches without that checkout and conflicting directories are preserved and rejected. Dependencies are linked from main only when both dependency manifests match; otherwise run `npm ci` in the task checkout. If dependencies change later, remove only the task's dependency link before installing a separate dependency tree; never install through a link into another checkout.

Review the task diff, run its checks, and commit task-owned files. From clean main:

```sh
node scripts/integrate.mjs task/creature-feedback
```

Integration holds one repository-wide lock, incorporates the locked main commit in the task checkout, checks the combined result and advances clean main. Dirty checkouts and unfinished Git operations block it. A competing integration fails as busy; retry later without terminating its owner. The OS releases the lock on exit, including crashes. A legacy directory lock is respected during the transition; inspect its owner before any separately authorized cleanup. Both worktrees are rechecked before main advances. Failed checks preserve committed task work. Successful integration removes its clean merged checkout and local branch while still holding the lock. Cleanup failure is reported as incomplete even if main already advanced; inspect the retained work and retry cleanup. Task-scoped pushes and hosted CI follow the authorization in AGENTS.md. PRs, releases, deployments and cleanup beyond clean merged task checkouts require separate authorization.

Audit accumulated local task branches and worktrees from clean main:

```sh
npm run worktree:cleanup
# Remove eligible merged tasks:
npm run worktree:cleanup -- --apply
```

Only local branches under `task/` or `codex/` whose commits are already in main are eligible. The sweep uses the integration lock and preserves dirty, unmerged, locked and unfinished checkouts. It never merges unreviewed work, forces removal, deletes remote branches or terminates preview processes. Apply mode exits unsuccessfully if any tasks were preserved; inspect those entries before treating cleanup as complete. Integration automatically cleans only the task being integrated, so another chat's newly created clean checkout is not swept during routine integration.

Before removal, ignored artifacts (reports, screenshots, logs and other ignored files) are copied to `fauna-worktree-archives/` inside the shared Git directory, with a manifest identifying the original checkout, branch and commit. Dependency installs and links under the checkout's root `node_modules` are disposable and are not archived. Archives remain local and are never automatically deleted; find them with `git rev-parse --git-common-dir`. Tracked and untracked changes always block removal. Close only preview processes owned by the completed task before its integration; cleanup does not stop processes or establish that another chat has finished.

## Verification

The [CI speed improvement plan](Docs/CI_SPEED_PLAN.md) describes proposed parallel jobs, browser sharding and rollout acceptance criteria; the execution policy below remains current.

| When                | Command                                                         | Evidence                                                                                |
| ------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Local smoke         | `npm test`                                                      | Fixed Node smoke only                                                                   |
| Task handoff        | `npm run check -- <task-owned paths>`                           | Selected formatting and fixed Node smoke                                                |
| Dirty set           | `npm run check -- --diff`                                       | Includes tracked and untracked changes                                                  |
| Committed task      | `npm run check -- --base <commit>`                              | Combined committed and dirty changes                                                    |
| Documentation edits | `npm run docs:check`                                            | Local links, anchors, file references, npm commands and document reachability           |
| Focused regression  | `npm run test:full -- <test paths>`                             | Only the named unit suites                                                              |
| CI                  | `npm run verify:full`                                           | Full static, documentation, all units/DOM, build, bundle allowance and browser journeys |
| Windows CI          | `npm run package:win` then `npm run test:desktop -- --packaged` | Unpacked x64 build and packaged startup/save/resume/isolation                           |

`npm run verify` aliases the local check. Use explicit paths in a mixed checkout. Markdown-only local checks skip smoke; run the documentation gate separately. Integration automatically adds the documentation gate when its combined diff changes Markdown. The documentation gate reads Git-listed files, skips deleted files, treats README and AGENTS as entry points, and checks commands in fenced examples. Prefix historical or foreign inline source references with their repository name, such as `Alchemy: src/example.ts`, rather than implying they are current Fauna files. Link every durable document from an existing owner or index.

Local smoke has one worker, a 512 MiB heap, lower process priority when available and a 30-second deadline. Formatting checks at most 50 existing files, each at most 256,000 bytes, within an 8,000-byte argument budget; larger selections are explicitly deferred to CI. The default gate does not install dependencies, traverse test dependency graphs, build, launch browsers/Electron or run full static or DOM suites.

Full unit runs, static checks, builds, browser/desktop journeys, packaging, coverage and performance runs are CI-owned by default. Agents run them locally only on explicit request. Do not substitute raw tool invocations to bypass this policy. Passing local integration is not full verification or release evidence.

CI writes unit and browser JSON reports under `reports/`, summarizes failures and evidence paths in the GitHub job summary, and uploads browser diagnostics even on failure. Missing reports are shown as unavailable, including when an earlier static gate prevented tests from starting. Browser CI stops after five failures to bound repeated layout diagnostics; a green run still executes the full suite. Reports do not supersede command exit status. CI checks the JavaScript allowance after each production build; it never builds twice solely to measure size. See [release boundaries](Docs/RELEASE.md) and [required rendered review](Docs/UI.md#required-review).

## Test value and coverage

Protect consequential player behavior, command rejection, ownership, persistence, lifecycle ordering and architectural boundaries. First inspect existing protection and choose the cheapest layer that can detect the plausible failure. Strengthen a nearby assertion where useful. Adding no permanent test is appropriate when existing coverage is adequate or a change is documentation-only.

Prefer focused behavioral assertions over tests of incidental implementation, markup or wrappers. Browser coverage should protect actual interaction and integration failures; arithmetic already covered in the engine rarely needs another browser journey. Never remove or weaken a regression test just to obtain a passing gate. Retain full coverage in CI while keeping routine local work bounded. Report exact suites run and remaining verification boundaries.

### Browser and UI coverage

Keep one full starter-to-victory browser expedition. Use seeded, bounded scenarios for keyboard/controller activation, combat swaps, rewards, save/resume, recovery and menu focus. Repeating a full expedition for each input mode adds cost without exercising directional navigation; the focused controller/menu journeys own that behavior. Controller coverage here is browser simulation, with physical-device and packaged validation governed by the release gates.

`tests/e2e/scroll-free.spec.ts` owns cross-screen layout coverage using `LAYOUT_CASES` in `tests/e2e/layout-contract.ts`: both text sizes at 1280×720, then one text size at each remaining supported viewport. Browse every creature, rank page and talent category at 1280×720 with enlarged text; sample first/last creature entries and talent categories elsewhere. Keep dedicated geometry checks for artwork profiles, ultrawide composition, reward anchors and the overlapping battle hand. Combat feedback additionally covers all four text/motion combinations at minimum size. This samples combinations deliberately; it does not prove every content/viewport/text/motion combination fits.

DOM tests own exhaustive rules, command rejection, focus ownership, pagination/resize and lifecycle cancellation. Reuse one mounted application for catalog browsing when cases do not require fresh state; retain independent cases for disposal, persistence and competing focus owners. Menu focus covers every page/exit pair and both origins per page rather than their full Cartesian product. Add a browser case only for a distinct integration or rendering failure, and keep screenshots to distinct visible states (one per Boons page, rather than one per item on that same page). Preserve timing waits that verify held-input suppression, autoplay pauses or real audio; use state/animation readiness for ordinary transitions.

Playwright listing verifies discovery only. Report measured execution time separately from case-count reductions; the CI browser report remains the runtime and rendered evidence source.
