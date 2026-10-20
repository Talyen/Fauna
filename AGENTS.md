# Fauna development

Fauna is a single-player creature-collecting card battler. Use plain language and player-facing names; include code details when useful.

## Working style

- Inspect status and relevant diffs before editing. Preserve unrelated work, scope patches and commits to task-owned paths, and re-read concurrently edited files. Ask only about ambiguous intent, unsafe merges, or consequential unresolved choices.
- Complete the requested behavior and its blockers. Fix small understood adjacent issues; report substantial independent findings. Avoid broad cleanup or unsolicited audits. Reuse existing owners and libraries; justify new dependencies or abstractions with concrete consumers.
- Read affected contracts and consumers, and update the canonical owner of changed invariants. Find filenames first, scope searches, and read relevant sections rather than dumping broad search results. For unclear failures, start with a compact failure digest and a specific hypothesis; reassess unproductive approaches and consult relevant history.
- Prefer tests that protect player behavior, ownership, persistence, or boundary contracts. Avoid tests that mirror implementation or add little regression value; a documentation-only change does not need new tests.
- Never discard unrelated work with destructive Git commands. Use fresh browser contexts for experiments instead of deleting player saves. Close only preview processes or sessions opened for this task; never terminate another task's verification lane.

## Worktrees and integration

Use one isolated Git worktree and task branch per implementation chat, starting from committed local main unless the user specifies another base. Reuse that chat's existing suitable worktree. Preserve unrelated edits and unfinished work in all checkouts; do not switch another checkout's branch.

Work independently. Do not discover or message other chats for routine coordination, startup, ownership, progress, verification windows, acknowledgments, or completion. Message only for a concrete unresolved dependency or conflict that repository inspection cannot answer. Do not poll or wake completed chats unless the user explicitly resumes them; routine incoming messages require no reply or renewed work.

Task-scoped branch/worktree creation, commits, and local integration are authorized unless the task restricts them. After review and verification, commit only task-owned paths and run `node scripts/integrate.mjs <task-branch>` from the main checkout. This holds the shared integration lock while incorporating current main in the task worktree, verifying the combined result, and advancing only clean main. If busy, retry later without removing another process's lock. Resolve understood conflicts in the task worktree, commit, and retry; report ambiguous conflicts or dirty-main blockers without disturbing other work. Never integrate through an unprotected manual update to main. Keep unintegrated work committed and recoverable. Integration retains the task worktree. Pushes, PRs, publication, destructive cleanup, and changes outside this game require separate authorization.

## Find the owner

- [Architecture, application commands, saves and platform boundaries](Docs/ARCHITECTURE.md): `src/game/`, `src/application/session.ts`, and `src/platform/`.
- [Content and artwork](Docs/CONTENT.md): `src/game/content.ts` and `public/art/`.
- [UI, interaction and accessibility](Docs/UI.md), [menus and inspection](Docs/MENU_DESIGN.md), [expedition and progression](Docs/EXPEDITION_DESIGN.md).
- [Gameplay vocabulary](Docs/GLOSSARY.md): `src/game/glossary.ts`.
- [Run and verification commands](README.md#verify), [release and platform verification boundaries](Docs/RELEASE.md).

## High-risk invariants

- Gameplay in `src/game/` is platform independent. Keep I/O, clocks and ambient randomness outside it. Seeded randomness and committed plain immutable data determine outcomes; rejected commands retain state and RNG.
- Application orchestration in `src/application/` owns commands and save ordering. Presentation consumes committed events and never settles gameplay, grants rewards, or saves previews. Animations cannot block command acceptance.
- Change save schemas, validation, migrations and affected fixtures together. Preserve supported resume paths, stable content identities, backup recovery and serialized writes. Disposal revokes new commands while draining admitted saves; test lifecycle and ordering changes at their owning boundary.
- Keep displayed rules consistent with effects. Player actions need timely visible feedback and clear outcomes; essential meaning survives mute. Use concise labels and visible state rather than routine instructions or redundant success copy. Preserve accessible names and actionable errors.
- Creature artwork is 4:3 landscape; action artwork is 3:4 portrait. Use `ArtCard` for artwork surfaces. Follow [UI rules](Docs/UI.md): black background, gameplay content only, no promotional copy or decorative page chrome.
- Use `src/ui/tokens.css` for visual values and registered upstream shadcn primitives with their standard behaviors for all controls (see `scripts/shadcn-registry.json`). No homemade tabs, toggles, dialogs, or clickable layout elements. Preserve native keyboard behavior, modal focus ownership and focus return; gamepad navigation adapts to the primitives. The CI static gate (`npm run check:full`) enforces the source policy but cannot establish rendered interaction quality.

## Review and verification

Review the final diff and integration. Express behavior through names, types and valuable tests; comments explain non-obvious reasons, ordering or compatibility. Justify lint suppressions.

Default local verification is deliberately lightweight. Run `npm run check -- <task-owned paths>` before handoff; use `--diff` for the dirty set or `--base <commit>` for committed changes. It runs bounded selected-file formatting and fixed Node smoke. Markdown-only changes skip smoke. `npm test` runs the same fixed smoke suites with one worker, a 512 MiB heap limit, lower process priority when supported, and a 30-second deadline. `npm run verify` is another entrypoint for the local check. No default gate installs dependencies, walks the test dependency graph, runs full static or DOM suites, builds, launches browsers/Electron, or packages the game.

Focused unit tests are allowed when useful: `npm run test:full -- <test paths>`. Full unit runs, full static checks, production builds, browser/desktop journeys, packaging, coverage and performance runs belong to CI by default; run them locally only when the user explicitly requests broader local validation. Do not bypass this policy with raw tool invocations. Retain full regression coverage in CI rather than deleting suites to make local checks faster.

Integration runs the same lightweight check on the combined diff from the locked main commit, then advances clean main. Local integration is not full verification or release evidence. CI runs `npm run verify:full` for complete static checks, all units including DOM, the production build and browser journeys, plus Windows packaging and packaged desktop smoke. Report those gates as pending until observed for the exact commit.

For UI changes, follow [required rendered review](Docs/UI.md#required-review). CI owns the full viewport/input/state journeys. Inspect its rendered evidence when available; use a local preview or focused browser review only when requested. Report pending rendered review honestly. Passing local checks or geometry assertions alone does not establish visual acceptance.

Report completion, checks run, limitations, incidental fixes and unresolved decisions without log or diff dumps. Distinguish browser simulation, desktop, Windows packaging, physical controller, Steam client and Steam Deck verification; do not claim unrun gates passed. Stop after completion.
