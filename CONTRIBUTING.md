# Contributing

[AGENTS.md](AGENTS.md) owns scope, Git authorization, preservation of unrelated work, and gameplay invariants. [Scripts](scripts/README.md) maps commands to their implementation. Use the Node 24 LTS patch in `.node-version` and npm 12.2.1 (`npm install --global npm@12.2.1 --ignore-scripts`), and install dependencies with `npm ci`.

## Worktrees and integration

Create or reuse this task's isolated checkout from the main checkout:

```sh
npm run worktree -- creature-feedback
# Optional explicit base:
npm run worktree -- creature-feedback <base-ref>
```

The command creates `.worktrees/<task-name>` on `task/<task-name>` from committed local main by default. An existing matching checkout is reused without resetting files. Existing branches without that checkout and conflicting directories are preserved and rejected. Dependencies are linked from main only when dependency manifests, install settings and lifecycle scripts match. Run `npm run deps` in the task checkout when dependencies are missing or change: it reuses a matching shared link or detaches only that link and runs `npm ci` locally, using the project-pinned npm without changing the global install. Never run `npm ci` through a shared dependency link. Changing ordinary npm task commands alone does not invalidate dependencies.

Review the task diff, run its checks, and commit task-owned files. From clean main:

```sh
node scripts/integrate.mjs task/creature-feedback
```

Integration holds one repository-wide lock, incorporates the locked main commit in the task checkout, checks the combined result and advances clean main. Dirty checkouts and unfinished Git operations block it. A competing integration fails as busy; retry later without terminating its owner. The OS releases the lock on exit, including crashes. A legacy directory lock is respected during the transition; inspect its owner before any separately authorized cleanup. Both worktrees are rechecked before main advances. Failed checks preserve committed task work. Successful integration removes its clean merged checkout and local branch while still holding the lock. Cleanup failure for the integrated task is reported separately even if main already advanced; inspect that task and retry its cleanup. Git authorization is defined only in [AGENTS.md](AGENTS.md#worktrees-and-integration).

Optional repository maintenance, independent of completing an implementation task: audit accumulated local task branches and worktrees from clean main:

```sh
npm run worktree:cleanup
# Remove eligible merged tasks:
npm run worktree:cleanup -- --apply
```

Only local branches under `task/` or `codex/` whose commits are already in main are eligible. The sweep uses the integration lock and preserves dirty, unmerged, locked and unfinished checkouts. It never merges unreviewed work, forces removal, deletes remote branches or terminates preview processes. Preserved tasks are expected and reported without failing the sweep; they do not block another task. Operational failures such as an unavailable lock still fail. Integration automatically cleans only the task being integrated, so another chat's newly created clean checkout is not swept during routine integration.

Before removal, ignored artifacts (reports, screenshots, logs and other ignored files) are copied to `fauna-worktree-archives/` inside the shared Git directory, with a manifest identifying the original checkout, branch and commit. Dependency installs and links under the checkout's root `node_modules` are disposable and are not archived. Archives remain local and are never automatically deleted; find them with `git rev-parse --git-common-dir`. Tracked and untracked changes always block removal. Close only preview processes owned by the completed task before its integration; cleanup does not stop processes or establish that another chat has finished.

## Verification

Use one local completion gate:

```sh
npm run check -- <task-owned paths>
# Committed task, including any dirty changes:
npm run check -- --base <commit>
# Inspect coverage first; no checks run:
npm run check -- --plan <task-owned paths>
```

`npm run verify` is the same command. With no selection, `check` uses tracked and untracked changes against HEAD; `--diff` is an explicit alias for that selection. Use task-owned paths in a mixed checkout. Include a named regression suite when the printed selection does not cover the affected behavior.

Local completion means the final diff is reviewed, the task check passes, any required [rendered evidence](Docs/UI.md#required-review) is inspected, task-owned work is committed and protected integration succeeds. Local completion is useful on its own: report CI as pending unless exact-commit results are available. Pushes and publication retain the authorization rules in [AGENTS.md](AGENTS.md#worktrees-and-integration). Dirty main or ambiguous conflicts leave reviewed work committed on its branch.

### What the task check does

Before execution it prints the selected files, formatting batches, owning compiler environments, documentation coverage, focused suites and omissions. Formatting and lint use batches of at most 50 files, 256,000 source bytes and 8,000 argument bytes; a single larger file runs alone. Every existing selected source file receives its architecture/UI contracts, even across multiple batches. Larger selections never silently drop formatting, lint or contracts. Deleted source files still select their compiler environment; dependency/configuration changes select all environments.

Changed regression suites and existing filename-matched owner suites always run. A reverse import graph adds up to twelve further unit/integration suites, following transitive static imports, re-exports and literal `import()`/`require()` calls, including aliases. Additional related suites and files the graph could not parse are listed explicitly for CI. Computed imports, runtime file reads and external dependencies are not inferred; select a relevant regression by name when needed. If no suite matches, the fixed Node smoke runs and is labeled as smoke rather than affected-behavior coverage. Documentation-only changes run no tests.

Each lint/compiler/focused-suite subprocess has a 60-second deadline, a 1 GiB Node heap and one test worker. Focused suites run serially, one per subprocess; a timeout or failure blocks the gate. The standalone `npm test` smoke has one worker, a 512 MiB heap and a 30-second deadline. The task gate never installs dependencies, builds, launches browsers/Electron or publishes anything. If shared dependencies differ or are incomplete, it directs you to `npm run deps`.

### Execution and evidence

Task checks, named regression suites (`npm run test:full -- <test paths>`), documentation checks and task-scoped rendered review are authorized locally. Full static/unit runs, production builds, exhaustive browser/desktop journeys, packaging, coverage and performance remain hosted-CI work by default; broader local execution needs an explicit request. This is the single execution policy; other documentation links here. A focused visual preview covers only the changed flow and its [review tier](Docs/UI.md#required-review), not the full browser matrix. Do not bypass the policy through raw tool invocations.

[Hosted CI](Docs/CI.md) owns full verification, browser sharding, builds, Windows packaging and retained evidence. Its workflow details are reference material, not prerequisites to ordinary local work. `npm run verify:full` retains the sequential full-verification entrypoint. Local checks do not establish full CI or release readiness. Report only relevant unverified platform boundaries.

### Documentation scope

`npm run docs:check` checks maintained Markdown links, anchors, inline file references, npm examples and reachability from README or AGENTS. The task check runs it automatically when Markdown changes. Link durable guides from an existing owner or index. Prefix foreign source references with their repository, such as `Alchemy: src/example.ts`.

Historical documents under `Docs/archive/` and task records under `Docs/task-evidence/<task>.md` are not live command/file contracts and need no index link. Maintained documents linking into them still require a real target and heading. Put reusable instructions in maintained docs; a historical record must not be the sole owner of a current rule. Ignored runtime reports and screenshots stay under `reports/` as before.

## Test organization

Focused suites are grouped by their contract owner under `tests/unit/`: `game/`, `application/`, `platform/`, `ui/`, `tooling/` and `simulation/`. Focused creature kits belong in `tests/unit/game/creatures/`; gameplay-only save round trips remain part of those suites. Kits that also exercise application policy or presentation belong in `tests/integration/creatures/`. Keep the complete scenario with its owning suite rather than splitting assertions to fit folders. Cross-layer scenarios live under `tests/integration/`: `creatures/` keeps complete kit, Auto-play, save/resume and presentation regressions together; `gameplay/` covers journey, resource and feedback contracts; `recovery/` covers recovery through application and presentation boundaries. Both groups are discovered by `vitest.config.ts` and run in the existing CI unit job, with the same per-suite Node or DOM environment. Do not split or remove valuable assertions merely to classify a suite. Put shared gameplay scenario builders in `tests/support/game.ts`, so browser suites do not depend on a unit-suite directory. Keep browser integration journeys in `tests/e2e/`, grouped by player flow; the complete starter-to-victory journey remains in `expedition.spec.ts`. Browser-only save setup, input simulation, layout contracts, rendered-evidence capture and journey driving belong in `tests/e2e/support/`. Moving a suite requires updating the fixed local smoke selection when affected, plus explicit route or documentation references; the recursive full-suite discovery must include both groups.

## Test value and coverage

Protect consequential player behavior, command rejection, ownership, persistence, lifecycle ordering and architectural boundaries. First inspect existing protection and choose the cheapest layer that can detect the plausible failure. Strengthen a nearby assertion where useful. Adding no permanent test is appropriate when existing coverage is adequate or a change is documentation-only.

Prefer focused behavioral assertions over tests of incidental implementation, markup or wrappers. Browser coverage should protect actual interaction and integration failures; arithmetic already covered in the engine rarely needs another browser journey. Never remove or weaken a regression test just to obtain a passing gate. Retain full coverage in CI while keeping routine local work bounded. Report exact suites run and remaining verification boundaries.

### Browser and UI coverage

Keep one full starter-to-victory browser expedition. Use seeded, bounded scenarios for keyboard/controller activation, combat swaps, rewards, save/resume, recovery and menu focus. Repeating a full expedition for each input mode adds cost without exercising directional navigation; the focused controller/menu journeys own that behavior. Controller coverage here is browser simulation, with physical-device and packaged validation governed by the release gates.

`tests/e2e/scroll-free.spec.ts` separates Collection/rank pages, Talents/Glossary/Settings and battle-hand layout into independently seeded cases, preserving cross-screen coverage using `LAYOUT_CASES` in `tests/e2e/support/layout-contract.ts`: both text sizes at 1280×720, then one text size at each remaining supported viewport. Browse every creature, rank page and talent category at 1280×720 with enlarged text; sample the first and last catalog entries and talent categories elsewhere while checking every Collection grid page. Keep geometry checks for artwork profiles, ultrawide composition, reward anchors and the overlapping battle hand. The six-card hand journey owns both dock geometry and card hit-target checks using a single seeded battle per layout case; Collection artwork area checks belong to the kit browsing journey. A separate live-resize journey protects later-page selection, filter memory and focus return while moving between desktop and minimum viewports. Combat feedback additionally covers all four text/motion combinations at minimum size. This samples combinations deliberately; it does not prove every content/viewport/text/motion combination fits.

DOM tests own exhaustive rules, command rejection, focus ownership, pagination/resize and lifecycle cancellation. Reuse one mounted application for catalog browsing when cases do not require fresh state; retain independent cases for disposal, persistence and competing focus owners. Menu focus covers every page/exit pair and both origins per page rather than their full Cartesian product. Add a browser case only for a distinct integration or rendering failure, and keep screenshots to distinct visible states (one per Boons page, rather than one per item on that same page). Preserve timing waits that verify held-input suppression, autoplay pauses or real audio; use state/animation readiness for ordinary transitions.

Owned Boons exhaust content and capture every page at minimum size; other viewports capture the first and last pages. Merchant shelf and purchased-state layouts run across `LAYOUT_CASES`, while Merchant resume and independent tooltip preference persistence run once at minimum size. Keep full state comparisons around browsing and purchases; viewport repetition is for rendered layout, not repeated persistence policy.

Playwright listing verifies discovery only. Report measured execution time separately from case-count reductions; the CI browser report remains the runtime and rendered evidence source.

The lint gate enforces Hooks, accessibility, promise ownership and React Compiler immutability/ref/effect diagnostics. Any exception must be local, explain the specific ownership or DOM lifecycle requirement, and preserve behavioral coverage; mutable DOM nodes do not justify disabling checks across the application. Native ARIA roles remain valid where changing tags could alter layout or control contracts. Type-aware template coercion, string-sort style and test mock method binding are outside this gate. Prototype design labels are excluded from label association checks; player UI keeps those checks.

The ordinary desktop configuration checks all native code. `tsconfig.desktop-boundary.json` additionally requires explicit parameter types, unknown catch variables and exact optional properties in storage, preload, Steam transport/worker and resource/recovery boundaries. Remaining display/bootstrap code stays in the broader checked-JavaScript configuration while its consumers use typed native capabilities. Native wire results are validated before resolving those capabilities.

Automated accessibility scans in `tests/e2e/accessibility.spec.ts` cover home, all settings tabs, battle, pause and recruitment at the minimum viewport. WCAG A/AA violations fail ordinary browser CI, with full JSON and screenshots retained by the existing report pipeline. These scans supplement keyboard, controller simulation and rendered review; they do not establish manual assistive-technology or physical-device acceptance.
