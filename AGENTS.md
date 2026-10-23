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

After review, commit task-owned paths and run `npm run finish` from the task checkout. Integration is the single required final local verification gate; a separate pre-integration gate is unnecessary. The command holds the shared integration lock, incorporates current main, checks the combined result and advances clean main. It retains the task checkout, branch and evidence for follow-up work. A busy lock waits briefly; retry after its bounded wait and never remove another process's lock. Resolve understood conflicts in the task worktree and retry; preserve ambiguous conflicts or dirty-main blockers. Retiring completed checkouts is separate, optional maintenance under the authorization above; unrelated unfinished tasks do not block completion. See the [workflow](CONTRIBUTING.md#worktrees-and-integration).

## Find the owner

- [Architecture, application commands, saves and platform boundaries](Docs/ARCHITECTURE.md): `src/game/`, `src/application/session.ts`, and `src/platform/`.
- [Content and artwork](Docs/CONTENT.md): `src/game/content.ts` and `public/art/`.
- [Creature design](Docs/CREATURE_DESIGN.md): use the [creature design skill](.agents/skills/fauna-creature-design/SKILL.md) for artwork-led passive and ability options, kit implementation, and Boss/Legendary design.
- [UI task procedure](Docs/UI.md#required-review): the single checklist for visual and interaction work. Use the repo [UI design](.agents/skills/fauna-ui-design/SKILL.md), [UI critique](.agents/skills/fauna-ui-critique/SKILL.md), or [art direction](.agents/skills/fauna-art-direction/SKILL.md) skill for the corresponding task; consult [references](design/visual-quality/README.md) for composition or art direction
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
- Keep displayed rules consistent with effects, preserve accessible names and make outcomes clear without sound. Reuse the [recovery owners](Docs/UI.md#recovery-owners) for failure handling; screens must not invent retries or save recovery.
- Use the [shared layout recipes](Docs/UI.md#shared-layout-recipes), tokens, ArtCard and registered shadcn controls. The [UI contract](Docs/UI.md) owns viewport fit, artwork, typography, spacing and interaction details; change a shared owner when a screen needs a reusable capability.

## Review and verification

Review the final diff and integration. Express behavior through names, types and valuable tests; comments explain non-obvious reasons, ordering or compatibility. Justify lint suppressions.

Run `npm run review:diff` in the task checkout, commit task-owned paths and run `npm run finish`. Integration runs the final changed-file gate. During development, use `npm run verify:changed` for focused checks, `--test <suite>` for extra regressions and `--diagnostic <mode>` for bounded investigation. Extra `--test <suite>` selections are remembered for integration; use `--forget-test <suite>` to remove an obsolete selection. `npm test` runs unit/DOM tests; `npm run check` runs full static checks. Follow [Contributing](CONTRIBUTING.md#verification) for coverage and CI boundaries; use `npm run deps` for missing or changed task dependencies.

For visual changes, follow the single [rendered review procedure](Docs/UI.md#required-review). Task-owned focused preview/review is authorized by default. Integrate only after current rendered evidence is inspected; preserve work on its branch if that evidence is unavailable.

Report completion, checks run, limitations, incidental fixes and unresolved decisions without log or diff dumps. Distinguish browser simulation, desktop, Windows packaging, physical controller, Steam client and Steam Deck verification; do not claim unrun gates passed. Stop after completion.
