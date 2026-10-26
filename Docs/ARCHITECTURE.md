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

`team` and `reserves` are the authoritative ordered creature arrays; together they contain at most one individual of each species. Owned species and deployed IDs are derived; saves contain no roster or lineup mirrors. Every phase has expedition state and prepared encounters consume committed packs under one eight-battle contract. All species are available to encounter and recruit; Collection and later starter eligibility depend on actual recruitment. Results return directly home without an unlock pipeline.

[Committed event variants](../src/game/types.ts) require target, amount and damage type for damage and the corresponding facts for healing, Block, statuses and actions. [Feedback adaptation](../src/ui/battle/combat-feedback-model.ts) converts these facts to presentation entries without changing committed event order or inventing gameplay defaults.

`dispatch(state, command)` returns an accepted immutable snapshot with ordered events, or rejects with the original state and RNG. The exhaustive phase table admits commands before command-specific validation; all validation precedes mutation and RNG consumption. An explicit linear-congruential RNG makes equal seeds and accepted command sequences reproducible.

Command admission and save decoding share the supported revision and battle-turn ceilings; exhausted End Turn commands reject before mutation, and automatic turn advancement stops at the last resumable turn. Automatic turn skipping pauses while shared Food remains in battle, preserving its use during controlled turns.

The schema is a discriminated lifecycle union. Battle carries active combat; Recruit and Boon phases carry completed reward receipts without combat; destinations and terminal results carry their own payloads. Every non-draft phase requires a journey summary. Local capabilities, device preferences and transient presentation metadata never come from saved progression. Journey transitions install complete payloads inside the command transaction.

Settlement banks retained earnings once, clears combat and retains the completed encounter, outcome and earnings receipt. Pending offers never require defeated enemies or card zones to remain valid. Pending Boons must remain distinct and unowned throughout recruitment and Boon choice; invalid offers fall back to an intact save candidate. Recruiting an already rostered species only improves Collection rank, preserving the individual and its cards. Full-roster recruitment of a new species saves `reward.selectedRecruit` and Collection progress before presentation previews an exchange; only Confirm changes the roster. Browsing and previews never publish or save state.

Auto-end turn records its effective preference in the play command. Spending the last Mana can resolve the enemy turn within that same revision; disabling it leaves a resumable zero-Mana player turn. Victory takes precedence. Card previews use the same effect resolver on detached state without advancing the enemy turn or settling rewards. Player-facing projection explores finite chance and recipient decisions without consulting the saved RNG, retaining correlated outcomes. Hidden draws, unclassified randomness or exhausted replay/decision/work budgets produce an unresolved forecast rather than partial bounds. The presentation cache retains twelve projected models per immutable snapshot. Exact isolated resolution remains available to gameplay regressions.

Development victory requires a capability supplied only by development startup; ordinary dispatch rejects it. It reuses settlement, events and saves without inventing XP or restoring roster Health. Packaged startup ignores development URLs.

### Ability rules

[Ability kinds and parameters](../src/game/rules/ability-types.ts) own the gameplay catalog independently of vocabulary. Authored cards remain plain immutable data. The complete [rule catalog](../src/game/rules/abilities.ts) requires targeting, scaling, enemy support/adaptation, progression keywords and descriptions for every primary kind in one typed catalog. Ordinary automatic support policies are shared defaults; exceptions override them beside their descriptions. [Supplemental rules](../src/game/rules/supplemental.ts) require scaling, enemy support, keyword classification, recipient/global delivery, descriptions and explicit ordinary-attack utility assessment for every extra.

Rule modules import only other rule modules, Immer and types. Description labels arrive as a pure callback, keeping vocabulary and content initialization outside the rule catalog. Existing [card queries](../src/game/card-rules.ts) and [value queries](../src/game/combat/ability-values.ts) apply these policies; targeting has no fallback for an unregistered kind.

[Primary handlers](../src/game/combat/ability-handlers.ts) and [supplemental handlers](../src/game/combat/ability-extras.ts) separately require execution for every kind. Exhaustive switches dispatch each primary and supplemental kind directly, without one-use handler registries. Supplemental reflection explicitly handles harmful extras and retains support extras with their original actor. These executors cannot be imported by presentation or pure rule modules. The [ability orchestrator](../src/game/combat/abilities.ts) retains pre-play reactions, repeat decisions, once-per-ability random targeting and per-repeat attack setup; handlers retain live recipient discovery and use the existing combat scheduler.

[Visible ability facts](../src/game/ability-facts.ts) own healing benefits and ordinary primary-hit approximations; Mana-dependent damage uses the pool after the effective card cost, including free plays. [Card-zone queries](../src/game/card-zones.ts) share generated-card capacity and useful-draw facts. Application Auto-play owns ranking weights, priorities, stable tie breaks and its deliberate roster-recipient preference. These queries consume no RNG, inspect no hidden order and do not imply complete combat forecasts.

[Ability contract snapshots](../tests/unit/game/ability-contracts.test.ts) were recorded before extraction: authored descriptions, scaling, keywords and enemy adaptation plus representative command, preview, event/state, RNG, save/resume and Auto-play outcomes. Preserve the baseline during behavior-preserving changes; intentional mechanic changes need reviewed expectations. Existing combat and policy suites retain broader coverage.

### Modifier ownership

[Modifier bindings](../src/game/modifier-bindings.ts) connect every Talent ID, Boon ID and supported passive kind to its actual named implementation functions. The typed maps are exhaustive and contain typed module/export references; they do not dispatch gameplay or determine reaction order. Existing command and combat owners call these functions explicitly. Read-only interpretations in gameplay queries have a separate binding map; application ranking and deliberate approximations stay in application policy.

[The source contract](../scripts/checks/modifier-contracts.mjs) checks that each authored identity has a binding, each bound function selects that rule, and each function has a runtime caller or an entry in the existing typed combat scheduler. It follows named import aliases and re-exports. Adding another gameplay interpretation requires declaring that owner too. These are structural guarantees, not proof of effect correctness; [modifier behavior baselines](../tests/unit/game/modifier-contracts.test.ts) and focused mechanics regressions protect outcomes. Both the lightweight changed-file gate and full CI architecture checks enforce the contract. Runtime content validation rejects unbound authored modifiers.

[Boon rules](../src/game/rules/boons.ts) own shared numeric parameters and the descriptions derived from them. Content keeps Boon identity, name and catalog order. Execution and visible assessments read the same parameters. Creature tiers remain six complete definitions; modifier ownership does not introduce passive inheritance or rank generation.

[Battle modifiers](../src/game/combat/battle-modifiers.ts) own battle-start grants, victory recovery and Mana rules. [Card modifiers](../src/game/combat/card-modifiers.ts) own accepted-card counter reactions; [ability modifiers](../src/game/combat/ability-modifiers.ts) own pre-ability grants and repeat decisions. Damage, status, protection, turn and card-zone owners retain their existing specialized implementations. All run at their existing synchronous insertion points, with live liveness checks, numeric expression order and RNG order preserved. The binding catalog contains only immutable data and type-only implementation references; content validation never imports mutation handlers. Execution and presentation cannot import the catalog.

The pure [Talent rules](../src/game/rules/talents.ts) author descriptions beside their executable parameters, alongside the existing [Boon rules](../src/game/rules/boons.ts). Content retains Talent identity, name, row and order. [Passive amount queries](../src/game/progression.ts) sum matching effects at the current rank in authored order; callers explicitly select the base enemy tier with undefined state. [Talent chance queries](../src/game/chance.ts) check ownership before consuming RNG and retain the shared favorable-chance policy. Callers keep all liveness guards and reaction ordering. Whole `percent` values become chances or ratios by dividing by 100. Named saved-flag keys connect producers to later consumers without making consumption conditional on a Talent still being selected. Finding Rhythm binds damage accumulation and Dodge reset in `modifierImplementations`, and its chance read in `modifierQueries`. Free-card grants similarly bind their producer, `cardCost` query and accepted-play consumption; generic combat initialization remains the lifetime reset owner. These bindings add no saved fields or runtime dispatcher.

### Combat execution

The ability executor owns repeats, targets, primary effects and extras inside the engine's Immer draft. Typed catalogs require complete pure policies and mutation handlers for each effect. The engine retains validation, Mana, zones, accepted-play counters, XP and scheduling; application publication and saving remain outside gameplay.

[Combat policy](../src/game/combat/policy.ts) defines packet origins and reaction eligibility. [Resolution](../src/game/combat/resolution.ts) drives a synchronous, depth-first generator stack of [typed operations](../src/game/combat/operations.ts). Damage, protection, status and lifecycle handlers yield child operations without runtime imports between handlers or back into the scheduler. Children finish before parents resume; mutation handlers do not recurse into each other. [State helpers](../src/game/combat/state.ts) own basic mutations and queries; [status transitions](../src/game/combat/status-state.ts) own control, attribution and deferred Bleed bookkeeping. `ensureCombat` explicitly initializes mutable draft state; read-only consumers use committed combat data. Damage resolution coordinates [pure arithmetic](../src/game/combat/damage-values.ts), captured payments and [ordered reaction families](../src/game/combat/damage-reactions.ts); [healing arithmetic](../src/game/combat/healing-values.ts) is also shared with visible policy assessment.

Armor depletion records a once-delivered receipt at each positive-to-zero transition; regrant permits a new receipt. Scheduler frames, depletion receipts and continuations never enter saves or published state. Actor knockout cancels remaining hits, extras and repeats while retaining committed effects; Death's Door at 1 Health permits continuation. Group Cleanse and Blind delivery recheck the actor after each recipient's reactions; Nightmare Harvest's Mana refund and control-triggered Boon follow-ups also require their source to remain alive. Enemies defeated by turn-start statuses cannot act.

Enemy targeting is policy over the shared executor. The pure [battle policy](../src/application/battle-policy.ts) is shared by player Auto-play and headless heuristics; it reads only visible state, uses stable identity tie breaks and consumes no gameplay RNG. Its [benefit assessment](../src/application/battle-benefits.ts) scores [legal play candidates](../src/game/play-queries.ts) using explicit ordinary-hit approximations and application-owned weights; the policy selects legal commands and applies stable tie breaks. Rankings expose reasons for automation journals rather than claiming complete forecasts. Ordinary enemies rank supported abilities through the shared [enemy evaluator](../src/game/combat/enemy-policy.ts), preferring a different ability only when values tie; adaptation omits player-only hand/Mana extras and unsupported resource-only abilities, retaining healing in draw-plus-heal cards. Legendary enemies own their deck/Mana rules. Enemy selection occurs at the action window, never inspection. Scaling and player-only exceptions belong to [journey rules](EXPEDITION_DESIGN.md#encounters) and [Keywords](KEYWORDS.md).

The [modifier ownership assessment](archive/MODIFIER_RULES_PLAN.md) retains the original proposal. The [implementation evidence](task-evidence/2026-10-23-modifier-contracts.md) records the local implementation, unchanged behavior comparisons, protected integration and pending hosted checks.

The [follow-through record](task-evidence/2026-10-23-modifier-followthrough.md) records the reconciled Talent parameters, deferred-effect bindings and their verification scope.

## Save contract

Desktop saves use Electron’s Fauna user-data `saves/expedition.json`; browser saves use `fauna.save.v1`. Both keep two backups. Follow the [development-save policy](../AGENTS.md#development-saves). [save-format.json](../src/game/save-format.json) is the single version shared by gameplay validation, native storage and the package. Update schemas, semantic validation and current-format fixtures together.

### Loading and writes

Bundled content validation runs once inside [startup preparation](../src/ui/startup/prepare.ts), before session loading. Preparation rejects on fatal failure; [mounting](../src/main.tsx) cancels its owned work and settles the existing splash under the [startup UI contract](ui/screens.md#startup-loading). Disposal suppresses late success and failure callbacks.

[The session](../src/application/session.ts) keeps commands unavailable through local loading and bounded Cloud startup. Startup checks its generation and closing state before admitting each local read or starting Cloud, including after subscriber callbacks. Load tries the primary and then current-format backups. All-invalid development candidates silently start fresh. Read failures retry once, then allow in-memory play; writes must regain read access before rotating unknown data.

Accepted commands admit their encoded save to the serialized queue **before publication**. Reentrant subscribers therefore cannot reorder saves or dispose before an accepted save is admitted. State commits immediately; subscriber notifications retain each snapshot and finish in publication order before delivering reentrant updates. Failed writes retain live play and retry the newest state every five seconds. Disposal revokes readiness and new commands, unsubscribes the close handshake and drains admitted writes. [UI recovery](UI.md#recovery-and-persistent-failures) owns notices.

Storage rotates two distinct application-validated recovery checkpoints. Adapters import no gameplay implementation and preserve backups without a validation policy. Desktop preload supplies bounded approved checkpoint bytes; native storage matches them to existing slots inside its serialized lane. Corrupt primaries and repeated writes cannot evict distinct intact backups. Desktop flushes a temporary file, stages backups and renames over the primary; partial rotation leaves the old primary intact. Atomic-rename guarantees depend on the filesystem.

### Shutdown and crash recovery

Desktop close/quit first requests renderer flush. The session pauses commands, drains its queue and retries the latest failed save once. Main then revokes IPC admission, drains native writes and quits. Persistent failure is recorded but does not prevent closing. Force-kill, renderer crashes and power loss cannot guarantee that handshake.

Renderer crash recovery drains admitted native writes before ordinary validated reload, allows at most two reloads per app process and never restarts after close begins. Platform facts and crash dumps remain local without uploads.

## Cloud reconciliation and device preferences

[Cloud snapshot validation and hashing](../src/application/cloud-snapshots.ts), [pure reconciliation policy](../src/application/cloud-policy.ts) and [the controller](../src/application/cloud.ts) have separate owners. One metadata queue serializes hashing, local metadata writes and publication; generation checks revoke stale work. Reconciliation never merges progression fields. Each device owns two alternating remote slots; other devices' slots are read-only. Unknown ancestry creates competing heads. Prefer intact local progress, otherwise stable snapshot-ID order; preserve alternatives durably **before** installation or recording them as ancestors. Bound ancestry to 64 entries and remote inventory to 32 streams / 64 files of at most 1 MiB each. Snapshot construction captures parent identities and ancestry before hashing, validates its own output, rejects cross-profile parents and refuses to truncate a direct conflict head. Invalid/oversized files pause uploads without deletion; oversized slots are rejected before download while intact slots remain available for recovery.

Local saves remain authoritative offline. Metadata becomes durable after the gameplay save and before upload; transport never holds the local save lane. Automatic and explicit retries preserve alternatives and cannot replace existing local play; recovery can install a checkpoint when local progress is absent. Cloud startup and each retry have shared completions across callers; automatic and explicit retries use the latest local progress and can recover missing saves after initialization fails. Status observer failures cannot interrupt sync or retry scheduling, and leaving Pending cancels its scheduled retry. Each startup or retry timeout can revoke only its own generation. Disabled Cloud remains Unavailable if optional metadata persistence fails. Commits compare canonical payloads and skip uploads of already acknowledged checkpoints; reconciliation can still restore a missing remote slot. Startup continues locally after failure or five seconds; installation carries a generation lease checked before queuing disk work and before publishing. Already admitted writes drain in order, while expired installation cannot replace newer offline commands. Intact local Cloud metadata can recover missing gameplay slots; mismatched metadata is preserved before replacement, and standalone import requires missing profile progress. Explicit retry also recovers initialization failures. Shutdown drains local writes and allows at most two seconds for uploads.

### Native transport, profiles and protocol

An owned utility process contains blocking Steam calls and stops on app shutdown. Failed sends retire both request and timeout. The [wire boundary](../desktop/steam-wire.cjs) validates reply envelopes before matching requests and validates results before resolving them; malformed envelopes or results retire transport and reject pending requests while local metadata remains available. Steam teardown has one shared completion, immediately revokes overlay callbacks, and continues independent cleanup/metadata draining if native cleanup throws.

[Steam](../desktop/steam.cjs) pins an account and isolates its local profile. A new Steam profile may adopt valid standalone progress while preserving the original. Account changes reject transport and require restart. Without a client, ordinary launch continues the last local Steam profile offline; isolated automation ignores that pointer. A newly identified account always selects its own directory. Browser, preview, smoke and performance profiles never access live Steam. Fauna's [App ID](../desktop/steam-config.json) defaults to null; live setup and qualification belong to [Release](RELEASE.md#steam-setup).

Overlay activation synchronously revokes commands, cancels targeting/Auto-play and opens Pause; closing it does not resume. Display, sound and other device preferences remain separate from progression and Cloud; native display preferences use the profile’s `display.json`. [Display](../desktop/display.cjs) owns reachable native bounds and Windowed/Fullscreen through validated preload capabilities; automation uses isolated geometry.

Overlay and display notifications contain observer failures. A failed native overlay pump stops its timer, clears activation and attempts shutdown once after releasing its borrowed callback; a failed display notification cannot reject the preference write lane or prevent later writes. Display disposal suppresses late notifications and shares one completion across callers while draining admitted transitions and the final preference write. Standalone profile choices use the Steam metadata queue, so shutdown drains an admitted choice and concurrent choices cannot race the same temporary file.

The packaged renderer uses `fauna://app/` confined to `dist/`, rejecting foreign authorities, traversal, symlink escapes and writes. Permission requests/checks deny access. Production CSP denies network connections; development permits loopback HMR only. File-protocol privileges and Node inspection are disabled. [Package integrity](RELEASE.md#packaged-integrity) checks actual executable fuses and browser snapshots before renderer smoke.

## Implementation reference

### Gameplay owners

| Contract                                                    | Owner                                                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| State shape and derived types                               | [state-schema.ts](../src/game/state-schema.ts), [types.ts](../src/game/types.ts)                                                       |
| Command admission and transaction                           | [command-phases.ts](../src/game/command-phases.ts), [play-queries.ts](../src/game/play-queries.ts), [engine.ts](../src/game/engine.ts) |
| Encounter preparation, setup and settlement                 | [journey.ts](../src/game/journey.ts), [encounters.ts](../src/game/encounters.ts)                                                       |
| Creature identity, card ownership and formation             | [team.ts](../src/game/team.ts)                                                                                                         |
| Card owner versus acting creature and drawable fallen cards | [card-actors.ts](../src/game/card-actors.ts)                                                                                           |
| Draw, discard and FIFO overflow                             | [card-zones.ts](../src/game/card-zones.ts)                                                                                             |
| Shared player, preview and enemy execution                  | [combat/abilities.ts](../src/game/combat/abilities.ts), [ability-handlers.ts](../src/game/combat/ability-handlers.ts)                  |
| Turn scheduling and enemy decisions                         | [turns.ts](../src/game/combat/turns.ts), [enemy-policy.ts](../src/game/combat/enemy-policy.ts)                                         |
| Legendary decks, summons and reactions                      | [legendary.ts](../src/game/combat/legendary.ts)                                                                                        |
| Recovery, affordability and Recruit eligibility             | [destinations.ts](../src/game/destinations.ts)                                                                                         |
| Catalogs, effect descriptions and progression               | [Content](CONTENT.md), [Keywords](KEYWORDS.md)                                                                                         |

Preserve independently authored species, card and talent order: seeded selection consumes them. Stable definition IDs differ from journey creature IDs and card-instance slot IDs. A roster contains at most one individual per species; repeat recruitment improves Collection rank while retaining that individual. Formation changes must preserve the distinct [replacement and swap rules](EXPEDITION_DESIGN.md#roster-and-battles), including Legendary kit sizes and [generated copies](content/creatures/rookhaven.md).

Card ownership and the acting creature are distinct. [Oathara](content/creatures/oathara.md#identity-and-ownership) can act for a fallen deployed owner without changing the card's identity or zones; admission and execution use the shared actor query. Shared [Food](CONTENT.md#shared-food-cards) uses explicit neutral ownership and its own resolver, without inheriting a presenter's creature-specific card modifiers. Target queries include knocked-out roster allies for Resurrect; ordinary ally targeting uses living battlefield recipients.

[Progression](../src/game/progression.ts) owns starter eligibility and offer count for both journey generation and save validation. It also owns Talent selection validation and the prerequisites shared by purchases and saves; decoding does not reimplement category budgets or earlier-row requirements.

### Presentation owners

The shell [navigation reducer](../src/ui/shell/navigation.ts) owns page and overlay transitions and supplies one active-surface priority for rendering, input, effects and Auto-play. Its [focus adapter](../src/ui/shell/focus.ts) owns DOM references and semantic menu-action restoration.

[App](../src/ui/App.tsx) mounts the tooltip provider and [game shell](../src/ui/shell/game-shell.tsx). The shell alone owns transient navigation, command callbacks and modal focus restoration. Its [input router](../src/ui/shell/input.ts) receives state/callbacks; controlled [overlays](../src/ui/shell/overlays.tsx) render without acquiring navigation ownership. Extracted content receives data and callbacks.

Feature folders own their layouts; `shared/` owns reusable cards, combat readouts, rewards, navigation and effects. Shared presentation may consume gameplay queries and infrastructure, but cannot import UI feature folders. [Inspection requests](../src/ui/shared/inspection-model.ts) remain independent of the inspection feature. Registered controls, React infrastructure and dependency-light utilities have the lower-level boundaries described in the [design-system map](DESIGN_SYSTEM.md).

[Battle interaction](../src/ui/battle/battle-interaction.ts) owns transient selection, input and focus. [Target geometry](../src/ui/battle/use-target-line.ts) measures the existing layout; one [preview presentation model](../src/ui/battle/play-preview-model.ts) supplies affected units, guaranteed messages and exact or conditional readouts from authoritative alternatives. [Card rules](../src/game/card-rules.ts) classify targets, and gameplay queries supply legal explicit recipients without choosing random or future group targets.

[Audio playback](../src/ui/audio/audio-runtime.ts) owns each media voice's pending start, gain, fade timer and release state together. Music keeps explicit current and outgoing tracks; replacing a fade cancels its previous timer. One idempotent release path revokes callbacks and media resources, so late playback results cannot affect a replacement track or a disposed runtime. Diagnostic observer failures cannot escape media callbacks or prevent release. The runtime retains the six-effect limit, bounded warmup, gesture retry and device mute preferences.

`src/ui/styles.css` owns stylesheet order. Preserve shared declarations and repeated-selector order when moving CSS; unchanged declarations alone do not prove rendering parity. Result presentation shares one completion context so input and reduced motion finish the same animation from any consumer.

### Save validation details

[Save validation](../src/game/save.ts) checks content IDs, individual/card ownership, reserved battle identity namespaces, distinct positive Bleed Leech obligations per source, unique zones, Health bounds, formation limits, saved enemy packs with exact initial Health/room power, and phase/outcome coherence. Support visits validate stock, price bounds, visit/slot identities and purchase receipts with their phases. It validates FIFO overflow and rejects a waiting buffer alongside an unfilled hand. Generated cards require distinct IDs alongside complete permanent kits; creature-owned copies require valid battle ownership, while neutral ownership is restricted to supported temporary, level-zero Food. Discovery rejects duplicates, unknown species, recruitment without encounter records, roster species absent from Collection, and invalid starter offers/selections. Optional Recruit destinations admit only ordinary creatures. [Content validation](../src/game/content-validation.ts) is a separate startup/authoring boundary.

## Discovery and diagnostics

[Diagnostics](../src/application/diagnostics.ts) is a bounded session-owned collector with a separate persistence port. It records selected revision/phase fields rather than saves or arbitrary objects, truncates errors and redacts common paths/credentials, including directories with Unicode names. Sink failures, unavailable storage and recursive logging cannot affect gameplay. Stored history obeys the serialized-size limit as well as entry/message limits, including JSON escaping. Context receives the same path/credential redaction as messages; malformed context cannot suppress the original failure. Notifications snapshot their independently owned subscriptions, and disposal revokes collection. There is no player report/clipboard export or automatic upload.

`committedCommand` is transient session presentation metadata. Loading a checkpoint cannot manufacture a committed action or replay audio. Collection discovery and passive ranks belong to [journey progression](EXPEDITION_DESIGN.md); local browsing never grants them.

## Optional performance recording

[The recorder capability](../src/lib/performance.ts) isolates sink failures and idempotent span completion. Nested installations restore the previous active recorder when released, including out-of-order cleanup. Renderer startup supplies [the capture bridge](../src/platform/performance.ts) to the session and presentation; ordinary play installs no collector, clocks or retained performance log. Command resolution, encoding, publication and asynchronous queue/write waits have separate spans. Preview computation, hand geometry/motion, feedback dispatch and navigation supply presentation context without changing gameplay or motion ownership. Runtime cannot import the Node capture harness. [Performance tools](DEVELOPMENT_TOOLS.md#hitch-attribution-and-deep-traces) own capture format, budgets, trace interpretation and limitations.

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

The [startup simplification](task-evidence/2026-10-23-startup-simplification.md) records the completed removal of repeated bundled-content validation, terminal splash behavior and verification evidence.

The [combat and interaction implementation](task-evidence/2026-10-23-complexity-reduction.md) records the completed damage, status, targeting and Auto-play simplification and links its assessment and evidence.

The [simplification implementation record](archive/SIMPLIFICATION_IMPLEMENTATION.md) documents the six changes and links the approved assessment, verification boundaries and retained evidence. Historical records retain [lifecycle](archive/GAME_STATE_PLAN.md), [ability resolution](archive/COMBAT_RESOLUTION_PLAN.md) and [reaction ordering](archive/COMBAT_REACTIONS_PLAN.md) decisions and their original verification scope.
