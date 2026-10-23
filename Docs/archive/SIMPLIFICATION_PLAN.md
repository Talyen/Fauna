# Codebase simplification plan

Assessment date: October 23, 2026. Source baseline: `f7f319eed8399671608f6207c67af7f6898afa45`.

This is an implementation plan, not a claim that these refactors have been performed. The assessment traced gameplay state, encounter construction, recruitment and swaps, save validation, shell navigation, event presentation, application persistence and Cloud reconciliation. It also inspected the verification and integration tooling. Findings below describe confirmed structural costs; they are not reports of reproduced player bugs or measured performance problems.

The largest opportunities are deleting obsolete behavior and removing duplicated state. The next opportunities are making navigation and Cloud ownership explicit, then strengthening the event contract so presentation does less defensive interpretation. Splitting large files alone would leave the main problems intact.

## Priorities

| Order | Area                                    | Why it merits work                                                                                                                       | Confidence                                                       | Relative scope                                      |
| ----- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| 1     | Legacy three-encounter route            | Fixtures keep a second journey model alive throughout production rules, schemas and UI                                                   | High                                                             | Medium; fixture conversion is the main work         |
| 2     | Unreachable creature unlock flow        | Current saves require every species to be unlocked and forbid journey unlocks, but reveal subscriptions, queues and screens remain       | High for reachability; documentation intent needs reconciliation | Small to medium                                     |
| 3     | Duplicated roster and deployment state  | Four representations must agree during recruitment, swaps, battle entry and decoding                                                     | High                                                             | Medium to large; changes the save shape             |
| 4     | Shell navigation and focus coordination | Independent setters encode a navigation state machine across routing, overlays, pause rules and focus callbacks                          | High                                                             | Large; interaction regression risk                  |
| 5     | Loose presentation event contract       | One optional-field bag makes every consumer infer which fields and meanings apply                                                        | High                                                             | Medium to large; many producers and consumers       |
| 6     | Cloud reconciliation controller         | Policy, cancellation, metadata persistence, transport and lifecycle decisions share one closure with overlapping flags and promise lanes | High                                                             | Large; highest data-loss risk if handled carelessly |

Orders 1–3 offer the clearest removal of concepts. Order 6 has substantial reliability value but should come last because its existing safeguards are necessary and its rewrite risk is greater. No new runtime dependency is needed for any item.

## 1. Remove the fixture-driven legacy journey mode

### Evidence and cost

- [Encounter rules](../../src/game/encounters.ts), lines 90–130, implement two meanings of an encounter: saved expedition packs, or `ENCOUNTERS` when `expedition` is null. Final victory is encounter eight in one mode and encounter three in the other; Boss detection also changes by mode
- [Legacy encounter content](../../src/game/content/encounters.ts), lines 3–35, explicitly describes itself as a stable legacy route
- [Journey transitions](../../src/game/journey.ts), lines 267–305, conditionally prepare destinations depending on this mode
- [State schemas](../../src/game/state-schema.ts), lines 171–193 and 222–241, admit nullable expedition state in most phases; [save validation](../../src/game/save.ts), lines 56–68, specifically allows its short route
- [Destination presentation](../../src/ui/expedition/team-selection.tsx), line 35, displays either eight or three encounters
- [Shared test scenarios](../../tests/support/game.ts), lines 24–47, explicitly null the expedition before entering battle. [Performance fixtures](../../src/tooling/performance.ts), lines 46–57, do the same

Ordinary startup creates an expedition and starts the current journey. The inspected explicit null assignments are in test and tooling fixtures. This is therefore more than an old data constant: convenient fixture construction has become a production gameplay mode with different progression rules.

The cost is a wider valid-state space, repeated null handling and tests that can pass against a different route from the one players enter. Removing the old mode should make tests more representative while deleting runtime branches.

### Simpler design

Keep one eight-encounter journey contract. A prepared encounter always uses its committed pack. Boss and final-encounter rules depend on the encounter ordinal and authored Boss table, never on whether a route object happens to exist.

Tests may still arrange a specific battle, including a three-creature team or a particular opponent. They should arrange a valid current-format journey at that encounter. They do not need a separate progression mode to test a creature interaction.

### Implementation

1. Convert the shared battle builders and performance cases to explicit saved packs in current expedition state. Preserve each scenario's intended opponent, Health, turn and card-zone setup. Convert final-victory scenarios to the actual final encounter rather than changing the game's length for them
2. Check each converted fixture through `decodeSave(encodeSave(fixture))` at the builder boundary where persistence validity matters. Keep deliberately malformed-save fixtures separate from ordinary valid scenario builders
3. Make expedition state required for active and completed journeys. Draft can retain its existing empty route object; a pack can remain absent before encounter preparation. Phase requirements should explain that absence without enabling another game mode
4. Remove the fallback in `encounterSource`, conditional journey advancement, three-encounter Boss/final checks, UI count fallback, `ENCOUNTERS` export, its content file and validation loop
5. Advance the development save format and update current fixtures together. Reject obsolete saves; add no compatibility decoder or migration
6. Remove obsolete legacy-route tests after moving their useful combat, reward and scaling assertions to current-route fixtures. Update performance fixture identity so historical comparisons do not silently mix different scenarios

### Acceptance

- No runtime three-encounter route or `ENCOUNTERS` fallback remains
- First journey, collected-species drafts, Bosses fourth and eighth, recruitment and Boon settlement retain their current behavior
- Current-route command traces retain acceptance, RNG consumption, offers, earnings and ordered events. Convert fixtures before capturing the refactor's baseline; do not compare unrelated old and new fixture battles as though they were identical
- Save/resume works at destinations, combat, full-roster recruitment, support visits and results; malformed current saves remain rejected

Use the existing [encounter](../../tests/unit/game/encounters.test.ts), [journey lifecycle](../../tests/unit/game/journey-lifecycle.test.ts), [engine](../../tests/unit/game/engine.test.ts), [performance case](../../tests/unit/simulation/performance-cases.test.ts) and [full browser expedition](../../tests/e2e/expedition.spec.ts) coverage. Add a regression only for a missing boundary, rather than testing the absence of a particular implementation string.

## 2. Delete the unreachable creature unlock pipeline

### Evidence and cost

- [Game creation](../../src/game/engine.ts), line 45, installs all authored species in `unlocked`; `newRun` copies that list at line 390
- [State schemas](../../src/game/state-schema.ts), line 135, require that array to have the full catalog length; [save validation](../../src/game/save.ts), lines 69–74, requires every catalog species and uniqueness
- The journey schema at [line 206](../../src/game/state-schema.ts) allows zero entries in `journey.unlocks`
- Nevertheless, [unlock observation](../../src/ui/expedition/unlock-reveals.ts) subscribes to state changes and computes new unlocks. [The shell](../../src/ui/shell/game-shell.tsx), lines 84–89, 122–127 and 347–357, owns pending reveals, an active reveal queue and a special route. [The reveal screen](../../src/ui/expedition/unlock-screen.tsx) remains mounted conditionally

A validated current-format session cannot produce a fresh reveal through these rules. The pipeline contributes live subscription and navigation code without a reachable current gameplay outcome. Static unused-code tools cannot catch this because the components and functions still reference one another.

There is also a documentation contradiction: [expedition design](../EXPEDITION_DESIGN.md) still describes post-results creature reveals. Resolve that contradiction explicitly in the implementation record. The recommended contract is the one current creation, decoding and recruitment implement: all species are available to encounter and recruit; Collection and starter eligibility come from actual recruitment.

### Implementation

1. Verify that no current command grants `unlocked` entries or nonempty `journey.unlocks`; retain a short reachability explanation in the commit
2. Remove persisted `unlocked` and `journey.unlocks`, their copying and consistency checks. Preserve `discovery.encountered`, `discovery.recruited`, passive ranks and collected-species draft eligibility
3. Delete the observer, reveal component, shell queues, `unlocks` route and reveal-only styling or fixtures after checking their remaining consumers. Leaving results should return directly home
4. Update the current save version, fixtures, architecture description and contradictory reveal documentation together. Keep historical records historical
5. Rename stale tests that describe starting with an unlocked creature or unlocking through victory when their assertions actually establish recruitment or unchanged catalog availability

If a current product requirement to restore unlock progression is established before implementation, defer this deletion and specify its grant rules separately. Do not keep the unreachable implementation indefinitely as speculative preparation.

### Acceptance

Catalog availability, Collection discovery, six passive tiers, recruited copies and later starter pools are unchanged. Finishing or reopening results grants nothing extra. Inspect the actual results-to-home flow and relevant reduced-motion behavior before integrating UI deletions. Existing [Collection](../../tests/unit/game/collection.test.ts), [starter](../../tests/unit/game/starter.test.ts), [recruitment](../../tests/unit/game/recruitment.test.ts) and [journey results](../../tests/e2e/journey-results.spec.ts) coverage should establish these outcomes.

## 3. Stop persisting derived roster and lineup mirrors

### Evidence and cost

[The shared state schema](../../src/game/state-schema.ts), lines 139–144, stores:

| Field      | Meaning today                               |
| ---------- | ------------------------------------------- |
| `team`     | Ordered deployed creature objects           |
| `reserves` | Ordered backup creature objects             |
| `roster`   | Species counts represented as another array |
| `lineup`   | Ordered deployed creature IDs               |

[Recruitment](../../src/game/team.ts), lines 37–62, changes the species roster, changes one of the creature arrays, installs lineup IDs and then reconstructs those arrays. [Swaps](../../src/game/team.ts), lines 152–228, mutate deployed creatures and explicitly copy their IDs back into lineup. [Battle entry](../../src/game/journey.ts), lines 85–88, reconstructs deployment again. [Decoding](../../src/game/save.ts), lines 76–94 and 144–154, checks the mirrors agree.

The inspected formation-changing paths update `lineup` to the current `team`; the game has no independent next-battle lineup editor. Persisting both buys little while making recruitment of copies, Legendary formation changes and fixtures harder to reason about.

### Simpler design

Keep `team` and `reserves` as the authoritative ordered creature arrays. Derive roster species and deployment IDs when needed. The maximum roster is five; a database-style entity map, selector cache or normalized state framework would add complexity here.

The intended contract is:

```text
owned individuals = team followed by reserves
roster species = owned individuals mapped to species
deployment order = team mapped to creature ID
```

Keep identity distinct from species. Do not deduplicate creature copies. Keep deployed and reserve order because it can affect targeting, replacement choices and seeded selection.

### Implementation

1. Establish behavioral coverage that every legal formation-changing command retains the current deployment through rewards, next battle and save/resume. Include ordinary-to-Legendary and Legendary-to-ordinary cases
2. Replace read consumers of `roster` with small queries over the two arrays: roster size, species membership and the species list. Replace policy reads of `lineup` with current deployed IDs. Update tooling journal shapes deliberately if they expose the removed fields
3. Refactor recruitment to compute its next ordered formation locally, install the creature change once and reconcile cards. A transient array of next IDs is fine; persisting it as another authority is unnecessary
4. Remove `roster` and `lineup` from the schema and remove mirror assignments in start, recruitment and every swap path
5. Remove lineup-based reconstruction from battle entry. Retain a bounded team operation if recruitment still needs to repartition individuals, but require the desired formation explicitly rather than reading a second persisted authority
6. Delete only consistency checks made obsolete by removed data. Keep unique creature IDs, roster capacity, Health bounds, legal Legendary deployment, card ownership and card-zone validation
7. Advance the save version and update fixtures. Compare canonical creature arrays, cards, RNG and events against the baseline, projecting away only the removed fields and version

### Sensitive behavior to retain

Knockout replacement retains card-slot identities and spent zone positions. Card-driven swaps remove the outgoing kit from zones and shuffle the incoming kit. Legendary kit-size changes have their own reconciliation rules. Generated copies, upgrades, status attribution and enemy target references must remain correct. These are real gameplay distinctions; do not collapse them into an ambiguous `swap` helper to reduce lines.

### Acceptance

The save stores each creature in one owned array and stores deployment order once. Recruiting or swapping no longer updates independent species/ID mirrors. Duplicate-species recruitment affects only the chosen individual, and identical command sequences preserve card slots, zones, earnings, RNG and event order.

Use [swapping](../../tests/unit/game/swapping.test.ts), [recruitment](../../tests/unit/game/recruitment.test.ts), [save boundaries](../../tests/unit/game/save-boundaries.test.ts), [journey lifecycle](../../tests/unit/game/journey-lifecycle.test.ts), [recruit-team UI](../../tests/unit/ui/recruit-team.test.tsx) and the [browser swap flow](../../tests/e2e/battle-swaps.spec.ts). Update existing fixtures instead of maintaining adapters that recreate the old mirrors.

## 4. Give shell navigation one explicit transition owner

### Evidence and cost

[GameShell](../../src/ui/shell/game-shell.tsx), lines 58–80, independently owns route, menu visibility, modal kind, inspection, instance counters and opener/origin refs. Additional callbacks and effects coordinate them:

- Lines 91–98 compute pause state from several sources
- Lines 139–177 open dialogs, remember origins, return to pages and react to Cloud or Steam overlays
- [Input routing](../../src/ui/shell/input.ts), lines 46–99, independently interprets overlay priority and Back behavior
- Shell lines 301–327 derive effects scope and Popover openness with another overlay-precedence expression
- Shell lines 495–527 and [ShellOverlays](../../src/ui/shell/overlays.tsx), lines 65–68 and 103–142, implement focus return and replacement visibility separately

The shell being the composition root is appropriate. The problem is that the rules are represented by coordinated setters instead of named transitions. Extracting JSX into more files would leave each new flow responsible for knowing the same combinations.

### Simpler design

Use a small shell-specific reducer and a single active-surface selector. Keep the reducer outside React rendering and keep DOM elements outside its serializable state. Do not introduce a router package or general state-machine framework.

Model meaningful relationships explicitly:

- A menu page knows whether Back returns home or reopens the pause menu
- A pile or Boon dialog retains its parent surface
- Inspection may be on top of a pile, so one flat exclusive `modal` enum is insufficient
- Knockout replacement is derived from committed gameplay, not copied into navigation state
- Steam overlay, session readiness and Cloud blocking remain external facts; they trigger defined navigation actions and retain the session's command gate

Provide named actions such as `openPause`, `openMenuPage`, `backFromPage`, `openPile`, `inspect`, `closeInspection`, `returnHome` and `externalBlock`. Have one selector return the top surface and associated input scope, paused state and effects scope. Preserve the exact intended nesting rather than building an unrestricted overlay stack.

### Implementation

1. Write a transition table for existing flows, including Back precedence, menu page return, pile-to-inspection nesting, reopening during exit fades, mandatory replacement and external overlays
2. Introduce the reducer and derived active-surface result. Replace coordinated `setRoute`/`setMenu`/`setModal`/`setInspection` sequences with one transition at each caller
3. Keep opener element refs and DOM work in one shell focus adapter. Use stable semantic action IDs when an opener is recreated; stop locating menu entries by rendered text labels
4. Retain modal generation tokens where they protect against stale Radix exit callbacks. Centralize their ownership rather than deleting a guard merely because it looks defensive
5. Make input routing consume the active surface and named actions. Make overlay rendering and visual-effects scope consume the same result. Delete duplicate precedence formulas
6. Leave command saving, Auto-play scheduling, battle targeting and screen-local browsing state in their existing owners. Extract a small input-connection hook only if it makes ownership clearer; it must not become another navigation owner

### Acceptance

A new shell overlay or page should require a declared transition and presentation, without editing several independent priority formulas. Impossible or unsupported combinations should be absent from the model or rejected by its transitions. Keep real nesting supported.

Use [menu navigation](../../tests/unit/ui/menu-navigation.test.tsx), [input](../../tests/unit/ui/input.test.ts), [targeting](../../tests/unit/ui/targeting.test.tsx), [Auto-play](../../tests/unit/ui/autoplay.test.tsx), [inspection](../../tests/unit/ui/inspection.test.tsx), [Cloud UI](../../tests/unit/ui/cloud-ui.test.tsx) and [browser menu input](../../tests/e2e/menu-input.spec.ts). Inspect rendered mouse, keyboard and simulated-controller journeys, especially rapid close/reopen, page return and inspection above a pile. Do not treat DOM tests as native or physical-controller validation.

## 5. Replace the optional-field event bag with typed facts

### Evidence and cost

[GameEvent](../../src/game/types.ts), lines 112–127, gives every event the same set of optional fields. A `damage` event need not have a target, amount or damage type at the type level. Action metadata and status metadata are available on unrelated kinds.

Consumers compensate independently:

- [Combat audio](../../src/ui/audio/combat-audio.ts), lines 15–35, defaults missing amounts to zero and missing damage types to Physical
- [Feedback grouping](../../src/ui/battle/combat-feedback-model.ts), lines 16–39 and 50–65, infers notice and merge meaning from combinations of kind, outcome, optional amount and flags
- [Impact selection](../../src/ui/battle/combat-impact.ts), lines 4–9 and 45–47, must recheck fields that meaningful combat events should guarantee
- [Target preview](../../src/ui/battle/target-preview.tsx), lines 65–74, repeats amount and damage-type fallback behavior

This is an overly general data contract pushing complexity into every consumer. It does not prove current events are malformed; it makes malformed producer changes easy to accept silently.

### Simpler design

Use a discriminated union for actual emitted facts, starting with the numeric combat events. Require the fields the producer really knows, and narrow on the event kind. Preserve current event order, copy, numeric semantics and public discriminators wherever possible.

Keep presentation aggregation separate. A displayed feedback total is a view model, not a mutated gameplay event. Replace `FeedbackEntry extends GameEvent` with an explicit feedback type or intersection over the relevant variants.

### Implementation

1. Inventory real producers by kind before choosing required fields. Some existing `action` events are informational, and journey-end `knockout` notices have no target; do not accidentally require combat-only fields on these announcements
2. Define precise variants for damage, healing, Block changes, targeted knockout and status outcomes. Keep general journey/turn/reward notices explicit. If an existing kind contains two meanings, represent both accurately or make a separately reviewed discriminator change
3. Convert producers and consumers together, one family per commit. Use direct typed object literals; add constructors only when they remove repeated policy or formatting for multiple real producers
4. Create one conversion from committed events to the display facts used by feedback grouping. Keep audio and recoil based on unaggregated committed facts, as today
5. Replace fallback-based consumer logic with exhaustive narrowing where the new contract guarantees data. Keep genuine empty/no-op outcomes and optional presentation flags where their absence has intentional meaning
6. Remove transitional broad event types and casts. Do not add every unrelated property as optional to every variant just to preserve old access patterns

### Acceptance

A damage producer missing its real amount, target or damage type fails type checking; a text-only journey notice remains legal. Zero Health loss, full Block absorption, Dodge, Critical identity, periodic attribution, status removal and icon-only notices retain their intended meaning. Feedback merging must not change the underlying event stream or drive gameplay.

Use existing [presentation integration](../../tests/integration/gameplay/presentation.test.ts), [combat resolution](../../tests/unit/game/combat-resolution.test.ts), [reaction](../../tests/unit/game/combat-reactions.test.ts), [feedback](../../tests/unit/ui/combat-feedback.test.tsx), [audio](../../tests/unit/ui/audio.test.ts), [targeting](../../tests/unit/ui/targeting.test.tsx) and [rendered feedback](../../tests/e2e/combat-feedback.spec.ts) coverage. Preserve event snapshots; investigate differences instead of automatically refreshing them. This work is transient and should not require a gameplay save change.

## 6. Separate Cloud conflict policy from asynchronous ownership

### Evidence and cost

[createCloud](../../src/application/cloud.ts), lines 104–447, combines snapshot hashing and validation, startup import, head selection, conflict preservation, installation, metadata writes, upload confirmation, retries, offline takeover, flush and disposal.

Lines 109–126 coordinate `alive`, `generation`, `remoteReady`, `initialized`, `replacing`, `retrying`, current/pending snapshots, three promise references for different work and several durability markers. [Reconciliation](../../src/application/cloud.ts), lines 214–299, mixes pure ancestry decisions with awaited transport, preservation, installation and persistence. Similar generation/liveness checks appear after each asynchronous boundary. Startup, retry and flush each also own bounded waiting.

The size alone is not the finding. A reader cannot establish the conflict-selection rule without simultaneously understanding what commits and retries may invalidate, which snapshot is durable, and whether installation has begun. Policy and lifecycle changes have a large shared reasoning surface.

### Simpler design

Separate three concrete responsibilities:

| Owner                 | Responsibility                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot functions    | Canonical envelope validation, identity, hashing and bounded ancestry                                                                    |
| Reconciliation policy | Deterministic choice of retained head, alternatives to preserve, ancestry parents, installation eligibility and whether uploads are safe |
| Cloud controller      | I/O, queue admission, timeout/cancellation ownership, retries, publication and shutdown                                                  |

The reconciliation policy should accept validated snapshots plus an explicit `startup` or `background` mode and return a small decision record. It must not call transport or install state. It is not a generic workflow interpreter.

Represent lifecycle phases explicitly where doing so removes invalid combinations, but retain the orthogonal facts that really are independent: current durable snapshot, upload acknowledgement, pending latest upload and operation generation. A different enum for every Boolean would just disguise the same complexity.

### Implementation

1. Capture the current safety matrix from [Cloud tests](../../tests/unit/application/cloud.test.ts), then extract head selection and preservation policy without changing the I/O order
2. Move envelope functions out of the controller module if that gives policy tests an independent entrypoint. Keep the existing account, byte-size, device-count and ancestry limits
3. Introduce a lifecycle state with explicit startup, background/offline and disposed behavior. Use named validity checks for active operations instead of scattering subtly different cancellation conditions
4. Give hashing plus local metadata admission one clearly owned serialized lane. Route reconciliation metadata through that owner as well. Do not remove a queue until all of its callers are transferred and ordering tests establish that it is redundant
5. Keep remote transport outside local gameplay persistence. The upload pump owns a latest-pending snapshot and one in-flight operation; retain read-back confirmation and acknowledgement ordering
6. Make installation an explicit startup-only boundary following successful preservation. An offline timeout invalidates late reads but must not abandon an installation already admitted to the local save lane
7. Consolidate the repeated bounded-wait code inside Cloud only if one helper can express startup takeover versus flush/disposal completion accurately. Do not build a shared retry framework across session, Steam and UI
8. Remove old flags, duplicate lanes and temporary adapters only once their responsibilities have named replacement owners. Keep `createCloud` and the platform port stable unless an actual consumer needs a contract change

### Non-negotiable safety behavior

- Local gameplay remains authoritative offline and local saves never await remote transport
- Unknown ancestry is a conflict; sequence counters do not order progress across devices
- Conflicting alternatives are preserved before replacement; preservation failure prevents replacement
- Background retries cannot replace the journey being played
- Another device's slots remain read-only; unreadable files pause uploads without deletion
- Metadata is durable before upload, and overlapping commits retain causal ancestry
- Startup can continue locally after its bounded wait; late results cannot install an older head
- Shutdown and disposal retain their bounded optional-cloud behavior without dropping admitted gameplay writes

### Acceptance

Policy tests can establish every winner, preservation set and upload decision without timers or fake transport. Controller tests establish ordering and cancellation with deferred operations and fake clocks. Retain the current [session](../../tests/unit/application/session.test.ts), [platform session](../../tests/unit/application/platform-session.test.ts), [Steam transport](../../tests/unit/platform/steam-transport.test.mjs) and [shutdown](../../tests/unit/platform/shutdown.test.mjs) contracts.

This change must pass the existing divergent-head, failed-preservation, metadata-failure, stalled-startup, overlapping-commit, late-retry and disposal scenarios. A smaller file is not acceptance. The desired improvement is a conflict policy readable in isolation and a controller whose asynchronous ownership can be explained without reconstructing a flag matrix.

## Work that should remain deliberately explicit

Several sophisticated systems were inspected and are not recommended for wholesale replacement:

- **Combat reaction scheduling:** [the local generator stack](../../src/game/combat/resolution.ts) is small and enforces synchronous depth-first child completion without recursive handler entry. The [reaction implementation record](COMBAT_REACTIONS_PLAN.md) explains the ordering and knockout contracts. Replacing it with a generic event bus, asynchronous effects or casual direct recursion would remove useful guarantees
- **Command transactions and saves:** [session queue admission before publication](../../src/application/session.ts) protects against reentrant subscribers reordering accepted saves. Keep that invariant, immutable publication, backup validation and disposal draining
- **Gameplay distinctions:** separate enemy resource rules, player-only progression, card-driven versus knockout swaps, and captured reaction facts are meaningful. Do not merge them into Boolean-heavy generic functions
- **UI and rendering lifetimes:** Radix exit-focus guards, WebGL context recovery, reduced-motion handling and canvas scheduling have concrete regression coverage. Remove duplication only when ownership becomes clearer and rendered behavior remains equivalent
- **Verification and worktree tooling:** the bounded command launcher, owning test registry, source fingerprint and integration lock serve real isolation and coverage contracts. This review found stronger simplification opportunities in runtime state and dormant product paths

The existing [lifecycle union](../../src/game/state-schema.ts), centralized journey transitions, shared ability executor, platform boundaries and creature-kit organization are useful foundations. Extend those owners instead of reopening their architecture without a concrete need.

There are smaller readability opportunities in [card rule formatting](../../src/game/card-rules.ts), especially the deeply nested supplemental-effect expression at lines 173–204, and in repeated targeting classifications across engine, battle UI and Auto-play. Handle these after the six items above, or when changing those exact rules. Prefer a named exhaustive formatter or a small shared targeting query. Do not unify execution, descriptions, AI scoring and validation into a new universal ability DSL merely to eliminate switches that express different decisions.

## Delivery sequence and review gates

### Before changing runtime behavior

Use the current committed main when implementation begins and recheck these findings; this assessment's line references are a snapshot. Work in an isolated task checkout and preserve unrelated work. For each initiative, identify affected contracts and retain a small set of production-path command traces and named player-outcome assertions. Do not write a second combat or save interpreter as a comparison oracle.

Convert legacy fixture setup first. Capture baselines for the resulting current-route scenarios before changing their runtime owners. Keep removed-state projections narrow and explicit: save version, deleted redundant fields and fixture identity are legitimate differences; RNG, reward counts, card slots and event order are not.

### Suggested increments

1. **One journey model:** convert fixtures, remove the legacy route, update format and contracts
2. **Reachable progression only:** remove the dormant unlock pipeline and reconcile its stale documentation
3. **One roster authority:** remove species and lineup mirrors while preserving ordered creature arrays and card reconciliation
4. **One shell transition owner:** introduce the reducer, focus adapter and shared active-surface derivation, then delete old setters and priority formulas
5. **Typed event facts:** tighten event families and simplify consumers without changing their output
6. **Cloud policy and lifecycle:** extract deterministic policy first, then transfer queue/cancellation ownership in small reviewed steps

Each increment should leave a working game and remove its transitional code before completion. Save-shape increments follow the disposable-development-save policy independently; do not keep old shapes alive to avoid a format bump. Cloud can be delivered independently after these earlier items if it does not consume their changed fields directly.

### Verification during implementation

Follow [Contributing](../../CONTRIBUTING.md#verification) for focused checks, remembered extra suites and protected integration. For UI changes in items 1, 2, 4 and 5, use the [required rendered review](../UI.md#required-review), preserving input, focus, art, effects, timing and readable feedback. Item 3 also needs rendered review if roster/swap presentation changes. Passing source checks or a loading-state capture cannot establish parity.

### Definition of success

Assess each change by removed responsibilities and preserved behavior, not a promised line-count reduction:

- One supported journey model and no unreachable unlock subsystem
- Roster membership and deployment have no independently persisted mirrors
- Shell callers use named transitions and share one overlay-priority decision
- Event producers establish the facts their consumers require
- Cloud conflict policy is deterministic and independent of asynchronous transport ownership
- No temporary compatibility layers, new general-purpose framework or runtime dependencies
- Seeded gameplay, collection, card ownership, save ordering and recovery retain their tested contracts

Report actual verification separately for unit/DOM tests, browser simulation and rendered review, desktop execution, Windows packaging, physical controllers, Steam client and Steam Deck. Unrun gates remain unverified.

## Assessment delivery

This planning change edits documentation only. It introduces no runtime or visual change and requires no new tests. Documentation formatting, maintained links and protected integration are the relevant delivery checks; gameplay, rendered and platform verification belong to the eventual implementation increments above.
