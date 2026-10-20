# Architecture

`src/game/` owns content, commands, battle rules, seeded RNG, and save validation. It imports only its own modules, Immer, and Zod. It does not access the DOM, React, filesystem, Steam, clocks, or ambient randomness. `scripts/boundaries.mjs` checks that separation.

`dispatch(state, command)` returns either an accepted immutable state with ordered presentation events or a rejection retaining the original state. Validation occurs before RNG consumption or mutation. Gameplay and progression settle synchronously. Animation is a consumer of results; it cannot pay mana, damage a creature, grant a reward, or unlock content.

`src/application/session.ts` owns the runtime store and serialized save queue. Commands install committed state and immediately enqueue its encoding. Load examines primary followed by backups; malformed saves never enter gameplay. All-invalid candidates require a fresh-start action; read I/O failures block commands until retry. Failed writes retain the live game and expose retry. Disposal revokes commands and unsubscribes the close handshake while draining admitted writes.

`src/platform/` defines storage, desktop quit, and optional Steam cloud/achievement capabilities. The browser uses localStorage; desktop uses a sandboxed preload IPC bridge. Steam capabilities are unavailable in this milestone and gameplay does not require them.

`src/ui/` consumes the session and owns transient targeting, inspection, menu, and input modality. Zustand subscriptions expose application state. Motion respects the user's reduced-motion preference. Standard gamepads and keyboard navigation feed semantic actions and share focus navigation.

## Domain identity

Species and card definitions use stable authored IDs. A run-specific creature owns three card instances, each carrying its effect level. Creature IDs persist across deployment and reserve moves. Combat swaps retain card-instance slot IDs and zone positions while replacing definitions and owners; definition IDs and instance IDs are deliberately independent. The remembered starting lineup is separate from the currently deployed team. No individual creature carries progress between runs.

The authoritative aggregate includes permanent species unlocks, win count, keyword XP, talent IDs, and currency; plus the current roster, reserve creature state, starting lineup, deployed team/cards, run-wide relics, encounter, phase, and battle. Battle rewards are saved receipts. Banking happens atomically at battle settlement; choosing or skipping a reward never banks them again. Battle tracks draw, hand, discard, health/block, enemy marks and intents, turn, and mana. Knockout leaves inert card slots in battle zones. Normal draws skip them and the UI never renders them for knocked-out owners. If all deployed creatures fall, the next draw reserves slots for healthy replacements, allowing recovery without bonus cards. Enemy attacks stop when no deployed target lives; defeat requires all roster members to fall.

A linear-congruential RNG is explicit state. Destination offers, shuffles and intent choices consume it; presentation does not. Equal initial seeds and accepted command sequences yield equal results. Rejected commands retain state and RNG.

## Save contract

Development saves are disposable: there are no released player saves to preserve. Do not implement migrations or backward compatibility unless explicitly requested. Obsolete formats are rejected and can be reset through the existing recovery flow. The canonical agent policy is in [AGENTS.md](../AGENTS.md#development-saves).

Current save version 7 is validated by Zod and semantic checks for content IDs, ownership, unique card zones, health bounds, lineup completeness, destination offers, and phase/outcome coherence. Only the current format is supported in browser and desktop storage; fixtures track that format. Valid current-format backups remain recoverable.

Battle settlement banks actual retained currency and keyword XP once. Ordinary fights offer recruitment only; intermediate bosses offer relics only. The shared Reward screen consumes committed receipts and accepts a choice or Skip, with no acknowledgement phase or Continue command. No eligible choice advances immediately; final victory and defeat go directly to Journey results. The journey summary retains the outcome, battle count, gains, new unlocks, and last-battle receipt; opening results never grants rewards or saves.

Browser saves rotate primary to backup1 and backup1 to backup2 before installing the next snapshot. Desktop serializes writes, flushes a temporary file, rotates backups, then renames it over the primary. A partial backup rotation still leaves the old primary intact. Atomic rename guarantees depend on filesystem behavior; sudden power loss is not equivalent to graceful quit.

Desktop window close and application quit request a renderer flush first. The session pauses new commands, finishes its queue, and acknowledges only if the latest save succeeded. Main then revokes IPC admission, drains admitted writes, and quits. A failed save keeps the window open for retry. Renderer crashes and OS force-kill cannot run this handshake.

## Integration

From clean main, run `node scripts/integrate.mjs task/foundation` (or the appropriate task branch). The script acquires a repository-wide lock in the common Git directory, merges current main into the clean task worktree, runs `npm run check -- --base <locked-main-commit>` on the combined diff, checks both worktrees remain clean, and fast-forwards main. The local gate runs only bounded formatting and fixed Node smoke; full static, DOM/unit, build, browser and packaged desktop validation belong to CI. Integration reports that those checks remain pending. Failures preserve task work. The task worktree is retained; cleanup and remote publication are separate actions.

Spending the final mana resolves the enemy turn inside the same command and revision. Victory takes precedence over automatic turn advancement. Card previews run the same card-effect resolution without settling battle rewards, advancing the enemy turn, or publishing/saving the preview state. This retains the final enemy health forecast even when committing the card will advance directly to destinations.

## Keyword foundation

`src/game/keywords.ts` owns keyword vocabulary, definitions, aliases, availability, damage identities, and authored-effect classification. Content, progression and glossary consume it. The catalog includes planned Alchemy-derived mechanics without enabling them. Progression eligibility remains explicit and save-compatible. Presentation-only word matching cannot assign gameplay effects or XP. See [Keywords](KEYWORDS.md).
