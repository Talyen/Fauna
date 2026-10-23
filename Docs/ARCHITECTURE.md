# Architecture

This guide owns runtime boundaries, command transactions and persistence. [Journey design](EXPEDITION_DESIGN.md) owns progression, [Keywords](KEYWORDS.md) owns combat rules, [Content](CONTENT.md) owns authoring, and [UI](UI.md) owns presentation. Start with command resolution and saving below; implementation maps and validation details follow. Use `npm run context` to locate affected owners.

## Repository organization

| Layer              | Responsibility                                                           | Boundary                                                                                             |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/game/`        | Content, commands, combat, seeded RNG and save validation                | Imports only its own modules, Immer and Zod; no I/O, DOM, React, Steam, clocks or ambient randomness |
| `src/application/` | Session, save ordering, Cloud reconciliation and shared Auto-play policy | Orchestrates gameplay through platform ports                                                         |
| `src/platform/`    | Storage, quit and optional desktop/Steam capabilities                    | Browser localStorage or sandboxed preload IPC; no gameplay implementation in storage adapters        |
| `src/ui/`          | Committed-state presentation and transient input/navigation              | Never settles gameplay, grants rewards or saves previews                                             |
| `desktop/`         | Privileged Electron storage, display, protocol and Steam adapters        | Typed, validated preload capabilities                                                                |
| `src/tooling/`     | Playthrough, balance and performance harnesses                           | Consumes runtime contracts; runtime cannot import harnesses                                          |

[Boundary checks](../scripts/checks/boundaries.mjs) enforce imports and ambient-capability restrictions. Knip checks unused code. [Test maintenance](../tests/README.md) and the [script map](../scripts/README.md) own their respective organization.

## Command resolution and previews

`team` and `reserves` are the authoritative ordered creature arrays. Owned species and deployed IDs are derived; saves contain no roster or lineup mirrors. Every phase has expedition state and prepared encounters consume committed packs under one eight-battle contract. All species are available to encounter and recruit; Collection and later starter eligibility depend on actual recruitment. Results return directly home without an unlock pipeline.

[Committed event variants](../src/game/types.ts) require target, amount and damage type for damage and the corresponding facts for healing, Block, statuses and actions. [Feedback adaptation](../src/ui/battle/combat-feedback-model.ts) converts these facts to presentation entries without changing committed event order or inventing gameplay defaults.

`dispatch(state, command)` returns an accepted immutable snapshot with ordered events, or rejects with the original state and RNG. The exhaustive phase table admits commands before command-specific validation; all validation precedes mutation and RNG consumption. An explicit linear-congruential RNG makes equal seeds and accepted command sequences reproducible.

The schema is a discriminated lifecycle union. Battle carries active combat; Recruit and Boon phases carry completed reward receipts without combat; destinations and terminal results carry their own payloads. Every non-draft phase requires a journey summary. Local capabilities, device preferences and transient presentation metadata never come from saved progression. Journey transitions install complete payloads inside the command transaction.

Settlement banks retained earnings once, clears combat and retains the completed encounter, outcome and earnings receipt. Pending offers never require defeated enemies or card zones to remain valid. Full-roster Recruit saves `reward.selectedRecruit` and Collection progress before presentation previews an exchange; only Confirm changes the roster. Browsing and previews never publish or save state.

Auto-end turn records its effective preference in the play command. Spending the last Mana can resolve the enemy turn within that same revision; disabling it leaves a resumable zero-Mana player turn. Victory takes precedence. Card previews use the same effect resolver on detached state without advancing the enemy turn or settling rewards, retaining the final Health forecast even when commitment leaves battle.

Development victory requires a capability supplied only by development startup; ordinary dispatch rejects it. It reuses settlement, events and saves without inventing XP or restoring roster Health. Packaged startup ignores development URLs.

### Combat execution

The ability executor owns repeats, targets, primary effects and extras inside the engine's Immer draft. Exhaustive switches require execution, magnitude and enemy-support decisions for each effect. The engine retains validation, Mana, zones, accepted-play counters, XP and scheduling; application publication and saving remain outside gameplay.

[Combat policy](../src/game/combat/policy.ts) defines packet origins and reaction eligibility. [Resolution](../src/game/combat/resolution.ts) drives a synchronous, depth-first generator stack of [typed operations](../src/game/combat/operations.ts). Damage, protection, status and lifecycle handlers yield child operations without runtime imports between handlers or back into the scheduler. Children finish before parents resume; mutation handlers do not recurse into each other. [State helpers](../src/game/combat/state.ts) own atomic mutations and queries.

Armor depletion records a once-delivered receipt at each positive-to-zero transition; regrant permits a new receipt. Scheduler frames, depletion receipts and continuations never enter saves or published state. Actor knockout cancels remaining hits, extras and repeats while retaining committed effects; Death's Door at 1 Health permits continuation. Enemies defeated by turn-start statuses cannot act.

Enemy targeting is policy over the shared executor. The pure [battle policy](../src/application/battle-policy.ts) is shared by player Auto-play and headless heuristics; it reads only visible state, uses stable identity tie breaks and consumes no gameplay RNG. Rankings expose reasons for automation journals rather than claiming complete forecasts. Ordinary enemies select supported abilities without immediate repeats; adaptation omits player-only hand/Mana extras and unsupported resource-only abilities, retaining healing in draw-plus-heal cards. Legendary enemies own their deck/Mana rules. Enemy selection occurs at the action window, never inspection. Scaling and player-only exceptions belong to [journey rules](EXPEDITION_DESIGN.md#encounters) and [Keywords](KEYWORDS.md).

## Save contract

Desktop saves use Electron’s Fauna user-data `saves/expedition.json`; browser saves use `fauna.save.v1`. Both keep two backups. Follow the [development-save policy](../AGENTS.md#development-saves). [save-format.json](../src/game/save-format.json) is the single version shared by gameplay validation, native storage and the package. Update schemas, semantic validation and current-format fixtures together.

### Loading and writes

[The session](../src/application/session.ts) keeps commands unavailable through local loading and bounded Cloud startup. Load tries the primary and then current-format backups. All-invalid development candidates silently start fresh. Read failures retry once, then allow in-memory play; writes must regain read access before rotating unknown data.

Accepted commands admit their encoded save to the serialized queue **before publication**. Reentrant subscribers therefore cannot reorder saves or dispose before an accepted save is admitted. Failed writes retain live play and retry the newest state every five seconds. Disposal revokes readiness and new commands, unsubscribes the close handshake and drains admitted writes. [UI recovery](UI.md#recovery-and-persistent-failures) owns notices.

Storage rotates two distinct application-validated recovery checkpoints. Adapters import no gameplay implementation and preserve backups without a validation policy. Desktop preload supplies bounded approved checkpoint bytes; native storage matches them to existing slots inside its serialized lane. Corrupt primaries and repeated writes cannot evict distinct intact backups. Desktop flushes a temporary file, stages backups and renames over the primary; partial rotation leaves the old primary intact. Atomic-rename guarantees depend on the filesystem.

### Shutdown and crash recovery

Desktop close/quit first requests renderer flush. The session pauses commands, drains its queue and retries the latest failed save once. Main then revokes IPC admission, drains native writes and quits. Persistent failure is recorded but does not prevent closing. Force-kill, renderer crashes and power loss cannot guarantee that handshake.

Renderer crash recovery drains admitted native writes before ordinary validated reload, allows at most two reloads per app process and never restarts after close begins. Platform facts and crash dumps remain local without uploads.

## Cloud reconciliation and device preferences

[Cloud snapshot validation and hashing](../src/application/cloud-snapshots.ts), [pure reconciliation policy](../src/application/cloud-policy.ts) and [the controller](../src/application/cloud.ts) have separate owners. One metadata queue serializes hashing, local metadata writes and publication; generation checks revoke stale work. Reconciliation never merges progression fields. Each device owns two alternating remote slots; other devices' slots are read-only. Unknown ancestry creates competing heads. Prefer intact local progress, otherwise stable snapshot-ID order; preserve alternatives durably **before** installation or recording them as ancestors. Bound ancestry to 64 entries and remote inventory to 32 streams / 64 files of at most 1 MiB each. Invalid/oversized files pause uploads without deletion.

Local saves remain authoritative offline. Metadata becomes durable after the gameplay save and before upload; transport never holds the local save lane. Background retries preserve alternatives and cannot replace the active journey. Startup continues locally after failure or five seconds; late reads cannot install after offline takeover. Shutdown drains local writes and allows at most two seconds for uploads.

### Native transport, profiles and protocol

An owned utility process contains blocking Steam calls and stops on app shutdown. Failed sends retire both request and timeout. Steam teardown has one shared completion, immediately revokes overlay callbacks, and continues independent cleanup/metadata draining if native cleanup throws.

[Steam](../desktop/steam.cjs) pins an account and isolates its local profile. A new Steam profile may adopt valid standalone progress while preserving the original. Account changes reject transport and require restart. Without a client, ordinary launch continues the last local Steam profile offline; isolated automation ignores that pointer. A newly identified account always selects its own directory. Browser, preview, smoke and performance profiles never access live Steam. Fauna's [App ID](../desktop/steam-config.json) defaults to null; live setup and qualification belong to [Release](RELEASE.md#steam-qualification).

Overlay activation synchronously revokes commands, cancels targeting/Auto-play and opens Pause; closing it does not resume. Display, sound and other device preferences remain separate from progression and Cloud; native display preferences use the profile’s `display.json`. [Display](../desktop/display.cjs) owns reachable native bounds and Windowed/Fullscreen through validated preload capabilities; automation uses isolated geometry.

The packaged renderer uses `fauna://app/` confined to `dist/`, rejecting foreign authorities, traversal, symlink escapes and writes. Permission requests/checks deny access. Production CSP denies network connections; development permits loopback HMR only. File-protocol privileges and Node inspection are disabled. [Package integrity](RELEASE.md#packaged-integrity) checks actual executable fuses and browser snapshots before renderer smoke.

## Implementation reference

### Gameplay owners

| Contract                                        | Owner                                                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| State shape and derived types                   | [state-schema.ts](../src/game/state-schema.ts), [types.ts](../src/game/types.ts)                                  |
| Command admission and transaction               | [command-phases.ts](../src/game/command-phases.ts), [engine.ts](../src/game/engine.ts)                            |
| Encounter preparation, setup and settlement     | [journey.ts](../src/game/journey.ts), [encounters.ts](../src/game/encounters.ts)                                  |
| Creature identity, card ownership and formation | [team.ts](../src/game/team.ts)                                                                                    |
| Draw, discard and FIFO overflow                 | [card-zones.ts](../src/game/card-zones.ts)                                                                        |
| Shared player, preview and enemy execution      | [combat/abilities.ts](../src/game/combat/abilities.ts), [ability-values.ts](../src/game/combat/ability-values.ts) |
| Turn scheduling and Legendary decisions         | [turns.ts](../src/game/combat/turns.ts), [legendary.ts](../src/game/combat/legendary.ts)                          |
| Recovery, affordability and Recruit eligibility | [destinations.ts](../src/game/destinations.ts)                                                                    |
| Catalogs, effect descriptions and progression   | [Content](CONTENT.md), [Keywords](KEYWORDS.md)                                                                    |

Preserve independently authored species, card and talent order: seeded selection consumes them. Stable definition IDs differ from journey creature IDs and card-instance slot IDs. Duplicate species remain separate individuals. Formation changes must preserve the distinct [replacement and swap rules](EXPEDITION_DESIGN.md#roster-and-battles), including Legendary kit sizes and [generated copies](content/creatures/rookhaven.md).

### Presentation owners

The shell [navigation reducer](../src/ui/shell/navigation.ts) owns page and overlay transitions and supplies one active-surface priority for rendering, input, effects and Auto-play. Its [focus adapter](../src/ui/shell/focus.ts) owns DOM references and semantic menu-action restoration.

[App](../src/ui/App.tsx) mounts the tooltip provider and [game shell](../src/ui/shell/game-shell.tsx). The shell alone owns transient navigation, command callbacks and modal focus restoration. Its [input router](../src/ui/shell/input.ts) receives state/callbacks; controlled [overlays](../src/ui/shell/overlays.tsx) render without acquiring navigation ownership. Extracted content receives data and callbacks.

Feature folders own their layouts; `shared/` owns reusable cards, combat readouts, rewards, navigation and effects. Shared presentation may consume gameplay queries and infrastructure, but cannot import UI feature folders. [Inspection requests](../src/ui/shared/inspection-model.ts) remain independent of the inspection feature. Registered controls, React infrastructure and dependency-light utilities have the lower-level boundaries described in the [design-system map](DESIGN_SYSTEM.md).

`src/ui/styles.css` owns stylesheet order. Preserve shared declarations and repeated-selector order when moving CSS; unchanged declarations alone do not prove rendering parity. Result presentation shares one completion context so input and reduced motion finish the same animation from any consumer.

### Save validation details

[Save validation](../src/game/save.ts) checks content IDs, individual/card ownership, unique zones, Health bounds, formation limits, saved enemy packs with exact initial Health/room power, and phase/outcome coherence. Support visits validate stock, price bounds, visit/slot identities and purchase receipts with their phases. It validates FIFO overflow and rejects a waiting buffer alongside an unfilled hand. Generated copies require distinct IDs, valid battle ownership and complete permanent kits. Discovery rejects duplicates, unknown species, recruitment without encounter records, roster species absent from Collection, and invalid starter offers/selections. Optional Recruit destinations admit only ordinary creatures. [Content validation](../src/game/content-validation.ts) is a separate startup/authoring boundary.

## Discovery and diagnostics

[Diagnostics](../src/application/diagnostics.ts) is a bounded session-owned collector with a separate persistence port. It records selected revision/phase fields rather than saves or arbitrary objects, truncates errors and redacts common paths/credentials. Sink failures, unavailable storage and recursive logging cannot affect gameplay. Disposal revokes collection. There is no player report/clipboard export or automatic upload.

`committedCommand` is transient session presentation metadata. Loading a checkpoint cannot manufacture a committed action or replay audio. Collection discovery and passive ranks belong to [journey progression](EXPEDITION_DESIGN.md); local browsing never grants them.

## TypeScript environments

[Base settings](../tsconfig.base.json) provide shared strictness and resolution. Each config follows its imports; import/capability checks supplement compiler globals.

| Config                                                | Environment                                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [game](../tsconfig.game.json)                         | ECMAScript; no DOM, Vite or Node globals                                                                                         |
| [renderer](../tsconfig.json)                          | DOM and Vite                                                                                                                     |
| [node](../tsconfig.node.json)                         | Node tooling/configuration                                                                                                       |
| [test](../tsconfig.test.json)                         | DOM and Node for tests/design studies                                                                                            |
| [desktop](../tsconfig.desktop.json)                   | JSDoc-checked privileged CommonJS and preload contract                                                                           |
| [desktop boundary](../tsconfig.desktop-boundary.json) | Explicit parameters, unknown catches and exact optional properties for storage, preload, Steam transport and recovery boundaries |

`npm run check:types` checks all six; broader desktop callbacks retain the ordinary checked-JavaScript inference. [Contributing](../CONTRIBUTING.md#verification) owns execution policy.

## Plans and history

The [further simplification plan](COMPLEXITY_REDUCTION_PLAN.md) prioritizes remaining damage-resolution, status-lifecycle, targeting and Auto-play complexity, with staged changes and behavior-preservation gates.

The [simplification implementation record](archive/SIMPLIFICATION_IMPLEMENTATION.md) documents the six changes and links the approved assessment, verification boundaries and retained evidence. Historical records retain [lifecycle](archive/GAME_STATE_PLAN.md), [ability resolution](archive/COMBAT_RESOLUTION_PLAN.md) and [reaction ordering](archive/COMBAT_REACTIONS_PLAN.md) decisions and their original verification scope.
