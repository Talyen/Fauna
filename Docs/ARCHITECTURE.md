# Architecture

`src/game/` owns content, commands, battle rules, seeded RNG, and save validation. It imports only its own modules, Immer, and Zod. It does not access the DOM, React, filesystem, Steam, clocks, or ambient randomness. `scripts/boundaries.mjs` checks that separation.

`dispatch(state, command)` returns either an accepted immutable state with ordered presentation events or a rejection retaining the original state. Validation occurs before RNG consumption or mutation. Gameplay and progression settle synchronously. Animation is a consumer of results; it cannot pay mana, damage a creature, grant a reward, or unlock content.

`src/application/session.ts` owns the runtime store and serialized save queue. Commands install committed state and immediately enqueue its encoding. Load examines primary followed by backups; malformed saves never enter gameplay. All-invalid candidates require a fresh-start action; read I/O failures block commands until retry. Failed writes retain the live game and expose retry. Disposal revokes commands and unsubscribes the close handshake while draining admitted writes.

`src/platform/` defines storage, desktop quit, and optional Steam cloud/achievement capabilities. The browser uses localStorage; desktop uses a sandboxed preload IPC bridge. Steam capabilities are unavailable in this milestone and gameplay does not require them.

`src/ui/` consumes the session and owns transient targeting, inspection, menu, and input modality. Zustand subscriptions expose application state. Motion respects the user's reduced-motion preference. Standard gamepads and keyboard navigation feed semantic actions and share focus navigation.

## Domain identity

Species and card definitions use stable authored IDs. A run-specific creature owns three card instances, each carrying its effect level. Creature IDs persist across deployment and reserve moves. Combat swaps retain card-instance slot IDs and zone positions while replacing definitions and owners; definition IDs and instance IDs are deliberately independent. The remembered starting lineup stores creature IDs separately from the currently deployed team. Multiple copies of a species are supported; swaps, release choices, card ownership and battle inspection address an individual by its ID. The roster species list counts copies rather than enforcing species uniqueness. No individual creature carries progress between runs.

The authoritative aggregate includes permanent species unlocks, win count, keyword XP, talent IDs, and currency; plus the current roster, reserve creature state, starting lineup, deployed team/cards, run-wide boons, encounter, phase, and battle. Battle rewards are saved receipts. Banking happens atomically at battle settlement; choosing or skipping a reward never banks them again. Battle tracks draw, hand, hidden overflow buffer, discard, health/block, enemy targets, turn, and mana. Knockout leaves inert card slots in battle zones. Normal draws skip them and the UI never renders them for knocked-out owners. If all deployed creatures fall, the next draw reserves slots for healthy replacements, allowing recovery without bonus cards. Enemy attacks stop when no deployed target lives; defeat requires all roster members to fall.

A linear-congruential RNG is explicit state. Destination offers, shuffles and intent choices consume it; presentation does not. Equal initial seeds and accepted command sequences yield equal results. Rejected commands retain state and RNG.

## Save contract

Development saves are disposable: there are no released player saves to preserve. Do not implement migrations or backward compatibility unless explicitly requested. Obsolete formats are rejected and can be reset through the existing recovery flow. The canonical agent policy is in [AGENTS.md](../AGENTS.md#development-saves).

Current save version 13 is validated by Zod and semantic checks for content IDs, ownership, unique card zones, health bounds, lineup completeness, destination offers, and phase/outcome coherence. Only the current format is supported in browser and desktop storage; fixtures track that format. Valid current-format backups remain recoverable.

Battle settlement banks actual retained currency and keyword XP once. Ordinary fights offer recruitment only; intermediate bosses offer boons only. The shared Reward screen consumes committed receipts and accepts a choice or Skip, with no acknowledgement phase or Continue command. No eligible choice advances immediately; final victory and defeat go directly to Journey results. The journey summary retains the outcome, battle count, gains, new unlocks, and last-battle receipt; opening results never grants rewards or saves.

Hands contain at most seven cards. Extra draws enter a FIFO buffer, which cannot be played or inspected as a separate zone. Accepted plays refill newly open hand slots from that queue without RNG. End turn discards the visible hand, retains overflow, restores four Mana and draws four cards after promoting waiting cards. Swaps preserve buffered card slots and update their owner along with other zones. Save validation includes the buffer in zone uniqueness/completeness and rejects a waiting buffer alongside an unfilled hand.

Browser saves rotate primary to backup1 and backup1 to backup2 before installing the next snapshot. Desktop serializes writes, flushes a temporary file, rotates backups, then renames it over the primary. A partial backup rotation still leaves the old primary intact. Atomic rename guarantees depend on filesystem behavior; sudden power loss is not equivalent to graceful quit.

Desktop window close and application quit request a renderer flush first. The session pauses new commands, finishes its queue, and acknowledges only if the latest save succeeded. Main then revokes IPC admission, drains admitted writes, and quits. A failed save keeps the window open for retry. Renderer crashes and OS force-kill cannot run this handshake.

## Integration

The [contribution workflow](../CONTRIBUTING.md#worktrees-and-integration) owns worktree creation, the shared integration lock, combined-diff verification and retained-checkout policy. [Script owners](../scripts/README.md) locate the implementation. Integration is local evidence only; CI and release checks remain separate.

With Auto-end turn enabled (the default), spending the final Mana resolves the enemy turn inside the same command and revision. The play command records its effective preference. Disabling it retains a saveable and resumable player turn at zero Mana; normal victory/defeat settlement remains immediate. Preview resolution is independent of this setting. Victory takes precedence over automatic turn advancement. Card previews run the same card-effect resolution without settling battle rewards, advancing the enemy turn, or publishing/saving the preview state. This retains the final enemy health forecast even when committing the card will advance directly to destinations.

## Keyword foundation

`src/game/keywords.ts` owns keyword vocabulary, definitions, aliases, availability, damage identities, and authored-effect classification. Content, progression and glossary consume it. The catalog describes active Alchemy-derived damage, defenses, statuses and removal mechanics. Gold stays outside the keyword catalog; Wish, Consume, Companion and Archery are excluded. Progression eligibility remains explicit and save-compatible. Presentation-only word matching cannot assign gameplay effects or XP. See [Keywords](KEYWORDS.md).

## Discovery and diagnostics

Permanent discovery stores encountered and recruited species separately from starter unlocks. Initial starters and unlocked species are known; accepted Begin battle discovers the exact enemy group, and accepted recruitment records the species once. Inspection consumes no RNG, grants no discovery and writes no save. Loss, return home and new journeys retain knowledge. Save validation rejects duplicate or unknown discovery records and recruitment without an encounter. No historical discovery is inferred for obsolete saves.

`src/application/diagnostics.ts` owns a bounded local collector exposed by the session. Its platform port owns persistence and explicit copying, separate from the game save. Reports contain selected revision/phase fields rather than arbitrary game objects. Sink failures and recursive logging cannot affect commands or saves. Session disposal revokes collection. `committedCommand` is transient session presentation metadata and never enters the saved aggregate; loading a checkpoint does not manufacture a new committed action or replay audio.

## Combat and destination health

`src/game/combat.ts` owns packet mitigation, seeded Dodge and crit, status buildup/ticks, Leech, crowd control, immunity and Death's Door. The command resolver owns turn sequencing and final settlement. Structured supplemental effects in content supply the same descriptions and keyword classification used by commands. Enemies select one of their species' three supported abilities without immediately repeating the last choice. Their supported descriptions omit player-only draw and Mana effects. Selection happens at the action window, never during inspection, and next intentions remain hidden.

Health and knockouts persist through victories, rewards, lineup changes and destination entry. Battle setup resets combat effects without restoring Health. A once-per-biome Campfire appears alongside the boss destination. Visiting it enters a saved Campfire phase; Rest restores 30% of maximum Health to every roster creature, including knockouts, and returns to the same boss offer. Rest does not advance the encounter or award currency/XP; its saved used flag prevents repeat healing and resets in the next biome.

Draw and discard surfaces use blank portrait art and the existing modal/inspection owners. Pile viewers sort by definition and instance identity, never draw order. Browsing does not publish gameplay, consume RNG or save.

## Automated and development combat

The pure application battle policy scores only visible cards and creatures, using stable identity tie breaks and no gameplay RNG or hidden intentions. Headless heuristic runs and player Auto-play share it. The UI scheduler admits at most one command per 700 ms, pauses while obscured or unfocused, and cancels pending callbacks on manual takeover, completion, navigation home, save failure or disposal. It never makes reward or progression choices. Session disposal makes readiness unavailable before draining admitted saves.

Development victory uses an explicit session capability supplied only by development startup. Ordinary dispatch rejects it. It marks enemies defeated and reuses ordinary settlement, events and saving, preserving roster Health and banking actual earned XP. Packaged desktop startup ignores development URLs.

Unlock reveals observe newly committed species additions that appear in journey unlock receipts. Consumption is transient for the mounted session; loading completed saves and reopening results never manufacture another reveal.

Talent categories are consolidated independently of combat damage identities. The current format stores Boon IDs, first-Burn consumption, and periodic status attribution. Old development saves, including Forge state and relic fields, are rejected. No capability or local display preference is restored from progression.
