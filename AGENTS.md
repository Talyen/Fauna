# Fauna development

Use an isolated Git worktree and task branch per implementation chat, based on committed local main. Preserve unrelated work. Do not discover or message other chats for routine coordination.

After review and verification, commit task-owned changes and integrate with `node scripts/integrate.mjs <task-branch>` from the main checkout. This serializes integration, incorporates current main in the task worktree, runs verification, and advances only clean main. Never manually overwrite dirty main. Pushes, publication, destructive cleanup, and changes outside this game require separate authorization.

Gameplay in `src/game/` is platform independent. Application orchestration in `src/application/` owns commands and save ordering; presentation never settles gameplay. Seeded randomness and committed plain immutable data determine outcomes. Creature artwork is 4:3 landscape; action artwork is 3:4 portrait. Verify rendered UI at desktop and handheld sizes. Follow [UI rules](Docs/UI.md): black background, gameplay content only, no promotional copy or decorative page chrome. Use `src/ui/tokens.css` for visual values, registered upstream shadcn primitives and their standard behaviors for all controls (see scripts/shadcn-registry.json; no homemade tabs, toggles, dialogs, or clickable layout elements), and `ArtCard` for artwork surfaces. `npm run check` enforces the source policy; review rendered interaction states and layout as well.

Run `npm run check`, `npm test`, `npm run build`, and focused browser tests before integration. Report desktop, physical controller, Steam client, and Steam Deck verification separately. Stop after completion.
