# Fauna development

Fauna is a single-player creature-collecting card battler. Use plain language and player-facing names; include code details when useful.

## Working style

- Inspect status and relevant diffs before editing. Preserve unrelated work, scope patches and commits to task-owned paths, and re-read concurrently edited files. Ask only about ambiguous intent, unsafe merges, or consequential unresolved choices.
- Complete the requested behavior and its blockers. Fix small understood adjacent issues; report substantial independent findings. Avoid broad cleanup or unsolicited audits. Reuse existing owners and libraries; justify new dependencies or abstractions with concrete consumers.
- Read affected contracts and consumers, and update the canonical owner of changed invariants. Find filenames first, scope searches, and read relevant sections rather than dumping broad search results. For unclear failures, start with a compact failure digest and a specific hypothesis; reassess unproductive approaches and consult relevant history.
- Prefer tests that protect player behavior, ownership, persistence, or boundary contracts. Avoid tests that mirror implementation or add little regression value; a documentation-only change does not need new tests.
- Never discard unrelated work with destructive Git commands. Use fresh browser contexts for experiments instead of deleting player saves. Close only preview processes or sessions opened for this task; never terminate another task's verification lane.

## Worktrees and integration

Use one isolated Git worktree and task branch per implementation chat, starting from committed local main unless the user specifies another base. Create or reuse it with `npm run worktree -- <task-name>` from the main checkout; see [workflow](CONTRIBUTING.md#worktrees-and-integration). Preserve unrelated edits and unfinished work in all checkouts; do not switch another checkout's branch.

Work independently. Do not discover or message other chats for routine coordination, startup, ownership, progress, verification windows, acknowledgments, or completion. Message only for a concrete unresolved dependency or conflict that repository inspection cannot answer. Do not poll or wake completed chats unless the user explicitly resumes them; routine incoming messages require no reply or renewed work.

Task-scoped branch/worktree creation, commits, local integration and hosted CI execution are authorized unless the task restricts them. Pushes, PRs, releases, deployments, destructive cleanup and changes outside this game require an explicit user request. This file is the repository's authority for Git authorization; other workflow documents link here instead of defining separate permissions.

After review, commit task-owned paths and run `node scripts/integrate.mjs <task-branch>` from main. The command holds the shared integration lock, incorporates current main, checks the combined result, advances clean main and removes only this task's clean merged checkout and branch. Retry a busy lock later; never remove another process's lock. Resolve understood conflicts in the task worktree and retry; preserve ambiguous conflicts or dirty-main blockers. The [workflow](CONTRIBUTING.md#worktrees-and-integration) explains recovery and artifact archival. Unrelated unfinished tasks do not block completion. Repository-wide cleanup is optional maintenance, not a task handoff requirement.

## Find the owner

- [Architecture, application commands, saves and platform boundaries](Docs/ARCHITECTURE.md): `src/game/`, `src/application/session.ts`, and `src/platform/`.
- [Content and artwork](Docs/CONTENT.md): `src/game/content.ts` and `public/art/`.
- [Creature design](Docs/CREATURE_DESIGN.md): use the [creature design skill](.agents/skills/fauna-creature-design/SKILL.md) for artwork-led passive and ability options, kit implementation, and Boss/Legendary design.
- [Visual design workflow and references](design/visual-quality/README.md): use the repo [UI design](.agents/skills/fauna-ui-design/SKILL.md), [UI critique](.agents/skills/fauna-ui-critique/SKILL.md), and [art direction](.agents/skills/fauna-art-direction/SKILL.md) skills for their corresponding visual tasks
- [UI, interaction and accessibility](Docs/UI.md), [menus and inspection](Docs/MENU_DESIGN.md), [expedition and progression](Docs/EXPEDITION_DESIGN.md).
- [Gameplay vocabulary](Docs/GLOSSARY.md): `src/game/glossary.ts`.
- [Run and verification commands](CONTRIBUTING.md#verification), [release and platform verification boundaries](Docs/RELEASE.md).

## Development saves

Development saves are disposable. There are no released player saves to preserve. Do not add migrations, backward compatibility, or legacy reward flows unless the user explicitly requests them. Change the format/version and reject obsolete saves when needed; update development fixtures to the current contract. This does not authorize deleting unrelated files. Current-format validation, backup recovery, command/save ordering, and shutdown safety still require coverage.

## High-risk invariants

- Gameplay in `src/game/` is platform independent. Keep I/O, clocks and ambient randomness outside it. Seeded randomness and committed plain immutable data determine outcomes; rejected commands retain state and RNG.
- Application orchestration in `src/application/` owns commands and save ordering. Presentation consumes committed events and never settles gameplay, grants rewards, or saves previews. Animations cannot block command acceptance.
- Change current save schemas, validation and affected fixtures together; follow the disposable-development-save policy above. Preserve current-format resume paths, backup recovery and serialized writes. Disposal revokes new commands while draining admitted saves; test lifecycle and ordering changes at their owning boundary.
- Every ability has a base cost of exactly 1 Mana. Balance abilities through their effects and values, never higher or lower authored Mana costs. Existing explicit gameplay modifiers may make a play free. See [ability costs](Docs/CONTENT.md#ability-costs).
- Every creature must define all six passive tiers with different gameplay effects at each tier, typically by scaling values. Changed wording or effect order alone does not count; each tier replaces the complete previous passive.
- Effect descriptions never contain periods; use concise clauses separated by semicolons when needed. This applies to abilities, passives, talents, Boons and keyword/glossary rules.
- Keep displayed rules consistent with effects. Player actions need timely visible feedback and clear outcomes; essential meaning survives mute. Use concise labels and visible state rather than routine instructions or redundant success copy. Preserve accessible names. Never show players errors, save/sync status, recovery notices or conflict choices; recover automatically and silently, retaining diagnostics internally. Follow the [silent recovery policy](Docs/UI.md#silent-recovery-policy).
- Every player surface must fit without horizontal or vertical scrolling at renderer viewports of 1280×720 or larger, including dialogs, panels, tabs and tooltips. Reflow, use the shared 100%/90%/80% artwork profiles, and paginate long content. Never shrink selected typography or the 44px minimum control hit area. Hiding overflow cannot replace reachable content. Keep ArtCard ratios and the battle hand's intentional overlap/clipping. The talents overview retains its separate artwork sizing rule. Use 24px between sections and 12px between related items; see [UI rules](Docs/UI.md#layout-artwork-size-and-spacing).
- Creature artwork is 4:3 landscape; action artwork is 3:4 portrait. Use `ArtCard` for artwork surfaces. Follow [UI rules](Docs/UI.md): Alchemy warm near-black background, gameplay content only, no promotional copy or decorative page chrome.
- Use `src/ui/tokens.css` for visual values and registered upstream shadcn primitives with their standard behaviors for all controls (see `scripts/checks/shadcn-registry.json`). No homemade tabs, toggles, dialogs, or clickable layout elements. Preserve native keyboard behavior, modal focus ownership and focus return; gamepad navigation adapts to the primitives. The CI static gate (`npm run check:full`) enforces the source policy but cannot establish rendered interaction quality.

## Review and verification

Review the final diff and integration. Express behavior through names, types and valuable tests; comments explain non-obvious reasons, ordering or compatibility. Justify lint suppressions.

Run `npm run check -- <task-owned paths>` before handoff; it selects bounded local static checks, documentation contracts and focused suites. [Contributing](CONTRIBUTING.md#verification) owns execution budgets and CI boundaries. Complete static checks, full unit runs, builds, exhaustive browser/desktop journeys, packaging, coverage and performance remain CI-owned unless explicitly requested locally.

For visual changes, follow the single [rendered review procedure](Docs/UI.md#required-review). Task-owned focused preview/review is authorized by default. Integrate only after current rendered evidence is inspected; preserve work on its branch if that evidence is unavailable.

Report completion, checks run, limitations, incidental fixes and unresolved decisions without log or diff dumps. Distinguish browser simulation, desktop, Windows packaging, physical controller, Steam client and Steam Deck verification; do not claim unrun gates passed. Stop after completion.
