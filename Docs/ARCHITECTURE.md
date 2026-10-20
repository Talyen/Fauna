# Architecture

`src/game/` owns content, commands, battle rules, seeded RNG, and save validation. It imports only its own modules, Immer, and Zod. It does not access the DOM, React, filesystem, Steam, clocks, or ambient randomness. `scripts/boundaries.mjs` checks that separation.

`dispatch(state, command)` returns either an accepted immutable state with ordered presentation events or a rejection retaining the original state. Validation occurs before RNG consumption or mutation. Gameplay and progression settle synchronously. Animation is a consumer of results; it cannot pay mana, damage a creature, grant a reward, or unlock content.

`src/application/session.ts` owns the runtime store and serialized save queue. Commands install committed state and immediately enqueue its encoding. Load examines primary followed by backups; malformed saves never enter gameplay. All-invalid candidates require a fresh-start action; read I/O failures block commands until retry. Failed writes retain the live game and expose retry. Disposal revokes commands and unsubscribes the close handshake while draining admitted writes.

`src/platform/` defines storage, desktop quit, and optional Steam cloud/achievement capabilities. The browser uses localStorage; desktop uses a sandboxed preload IPC bridge. Steam capabilities are unavailable in this milestone and gameplay does not require them.

`src/ui/` consumes the session and owns transient targeting, inspection, menu, and input modality. Zustand subscriptions expose application state. Motion respects the user's reduced-motion preference. Standard gamepads and keyboard navigation feed semantic actions and share focus navigation.

## Domain identity

Species and card definitions use stable authored IDs. A run-specific creature owns three card instances, each retaining a legacy upgrade field for save compatibility. Creature replacement retains the team slot ID but replaces the species and its card instances. No individual creature carries progress between runs.

The authoritative aggregate includes permanent species unlocks, win count, keyword XP, talent IDs, and currency; plus the current roster, active team/cards, run-wide relics, encounter, phase, and battle. Battle rewards are saved receipts. Banking happens atomically at battle settlement; continuing reward/recruit/relic phases never banks them again. Battle tracks draw, hand, discard, health/block, enemy marks and intents, turn, and mana. Knockout removes that creature's cards from all battle zones; its owned card instances remain in run data for recovery after victory.

A linear-congruential RNG is explicit state. Shuffles and intent choices consume it; presentation does not. Equal initial seeds and accepted command sequences yield equal results. Rejected commands retain state and RNG.

## Save contract

Save version 3 is JSON validated by Zod and semantic checks for content IDs, ownership, unique zones, live-card completeness, health bounds, encounter data, and valid phase outcomes. Version-one saves migrate `energy` to `mana`; version-two saves migrate their active team into the roster, retain in-progress cards, and receive empty new progression fields. a legacy exhausted turn resolves deterministically once during migration. The decoder validates roster uniqueness, talent affordability and row dependencies, reward/phase coherence, and all previous combat invariants. Primary legacy saves are rewritten through the normal ordered save queue, preserving their old payload in backups. Recovery from a legacy backup waits for the next accepted command before replacing the primary. The storage key/file name stays stable; the embedded version selects the format. Unsupported or invalid formats fall back to intact backups.

Browser saves rotate primary to backup1 and backup1 to backup2 before installing the next snapshot. Desktop serializes writes, flushes a temporary file, rotates backups, then renames it over the primary. A partial backup rotation still leaves the old primary intact. Atomic rename guarantees depend on filesystem behavior; sudden power loss is not equivalent to graceful quit.

Desktop window close and application quit request a renderer flush first. The session pauses new commands, finishes its queue, and acknowledges only if the latest save succeeded. Main then revokes IPC admission, drains admitted writes, and quits. A failed save keeps the window open for retry. Renderer crashes and OS force-kill cannot run this handshake.

## Integration

From clean main, run `node scripts/integrate.mjs task/foundation` (or the appropriate task branch). The script acquires a repository-wide lock in the common Git directory, merges current main into the clean task worktree, runs `npm run verify`, checks both worktrees remain clean, and fast-forwards main. Failures preserve task work. The task worktree is retained; cleanup and remote publication are separate actions.

Spending the final mana resolves the enemy turn inside the same command and revision. Victory takes precedence over automatic turn advancement. Card previews run the same effect resolution without advancing the enemy turn or publishing/saving the preview state.
