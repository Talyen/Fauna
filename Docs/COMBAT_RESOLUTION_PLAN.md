# Unify ability resolution

Status: proposed; implementation has not started

Assessment baseline: local commit `4911cd6`, 2026-10-21

## The architectural problem

Fauna has one command entry point but two ability interpreters. Player cards and enemy abilities use the same content definitions and low-level combat helpers, yet separately implement the sequence that turns an ability into its effects. This is the highest-priority architectural problem found in this review: it puts the rules most frequently extended by new creatures behind multiple independently maintained execution paths.

The problem is ownership of ability execution, rather than file length. Moving the two loops into smaller files would preserve it. The fix is one shared ability executor, with explicit policies for the differences between player cards and enemy actions.

### Evidence

Line references below refer to the assessment baseline; function names remain the useful landmarks after edits.

| Owner                                                                                              | Current responsibility                                                                                                  | Consequence                                                                     |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [engine.ts](../src/game/engine.ts), `finishTurn`, lines 561–703                                    | Selects enemy abilities and resolves their repeats, targets, primary effects and extras inside turn orchestration       | Enemy scheduling and ability semantics change together                          |
| [engine.ts](../src/game/engine.ts), `resolve`, `play` case, lines 907–1058                         | Independently resolves player repeats, targets, primary effects and extras, alongside Mana, card zones and XP           | Shared mechanics require parallel edits in the enemy loop                       |
| [engine.ts](../src/game/engine.ts), `applyExtras`, lines 464–560                                   | Shares follow-up effects but takes an enemy flag plus positional targeting, miss, critical and recipient-only arguments | Some execution is shared, while the ordering around it remains duplicated       |
| [content.ts](../src/game/content.ts), `CardDefinition` and `enemyCard`, lines 69–104 and 1177–1201 | Splits abilities into primary effects and extras; adapts enemy definitions through a string allowlist                   | New extras can disappear from enemy abilities unless a separate list is updated |
| [rules.ts](../src/game/rules.ts), `actionValue` and `enemyAbilityValue`                            | Already separates player scaling from enemy encounter magnitudes                                                        | This intentional policy distinction can survive a shared executor               |

Two specific extension hazards make this more than a cosmetic duplication concern:

- The enemy primary-effect chain ends with a generic Block branch at lines 664–670. The player chain uses independent effect checks. Adding a new primary effect to the content type does not require either interpreter to handle it exhaustively; an omitted implementation can become Block for enemies and do nothing for players.
- Enemy support is distributed across `enemyCard`, the repertoire filter inside `finishTurn`, and the enemy effect chain. For example, a draw ability with a healing extra becomes self-healing, while ordinary draw, Mana and recovery abilities are excluded from selection. A new effect needs an explicit decision across these owners today.

These are confirmed source-level maintenance hazards. This review does not claim a reproduced defect in an existing creature. Existing species tests cover many correct behaviors, including enemy actions and previews; they are assets to retain.

### Why prioritize this

Creature collection makes ability additions and combinations central to development. A missed enemy branch, changed repeat order, or inconsistent recipient selection directly changes fights. The duplication also increases the cost of proving previews, player actions and enemy actions use the intended rules.

Other candidates were considered. `GameState` represents phase-specific data with nullable fields, so save validation must reject impossible combinations. `App.tsx` concentrates navigation and focus state. Both deserve attention when changed, but neither needs to be rewritten to resolve the immediate split in shared gameplay semantics. Application persistence and platform access already have explicit owners and useful lifecycle protections. This prioritization is an architectural judgment based on source inspection, not a runtime performance finding or an exhaustive correctness audit.

## Intended ownership

Keep `dispatch` and its Immer transaction as the only command settlement boundary. Inside that transaction, player command handling and enemy turn scheduling call the same synchronous ability executor. Previews continue through the player command path and the same executor.

| Owner                           | Responsibility after the change                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command handling in the engine  | Validate before mutation/RNG; pay Mana; move card slots; award play XP; invoke execution; update once-per-card counters; refill hand; settle; optionally advance the turn |
| Enemy turn scheduling           | Status ticks, action admission, repertoire selection, encounter scaling, last-ability history, turn counters and existing settlement checkpoints                          |
| Shared ability executor         | Repeat admission, per-repeat liveness checks, attack setup, primary effects, recipient extras and global extras, in their existing deterministic order                    |
| Existing combat helpers         | Damage, healing, protection, statuses and reactive interactions; retain current ordering and recursion guards                                                             |
| Existing rules/content policies | Player values and progression, enemy values/base passives, and explicit enemy repertoire adaptation                                                                       |
| Application session             | Publish accepted state/events and admit serialized saves; no new gameplay execution responsibilities                                                                      |

Use a proposed game module named `abilities.ts` as the shared owner, with a synchronous `executeAbility` entry point used by both callers. Use a small typed execution context with an explicit side, actor, adapted definition, computed value, target selection and player-only modifier information. An internal discriminated player/enemy context should prevent enemy actions from receiving player card bookkeeping. Centralize access to friendly and opposing deployed rows through that context; read current membership and order after swaps or knockouts rather than caching stale target arrays. Keep IDs and persisted creature/enemy shapes unchanged.

The executor mutates only the transaction draft and appends to its ordered event list. It does not dispatch commands, begin another Immer transaction, settle rewards, save, publish, await animation or expose a resumable capability. It must not import the command engine; pass the narrow existing swap/recovery operations if extraction would otherwise create a circular dependency.

Start with ordinary functions and exhaustive switches over existing effect types. No generic event bus, plugin registry, configurable combat language or replacement of the working damage pipeline is required. Add an abstraction only when the player and enemy call sites both use it.

## Behavior to preserve

- Equal seeds and commands produce equal full states, final RNG and ordered events. Preserve the number and order of random draws, including unsuccessful repeat checks and random target selection. Compute intrinsic values at the same point as today rather than recomputing them after each repeat.
- Enemy selection keeps its no-consecutive-ability rule, current repertoire exclusions, draw-to-self-heal conversion and encounter magnitudes. Enemies retain base passive tiers; player progression, Mana, card zones and XP remain player-only. Healing modifiers and first-attack behavior must retain their side-specific rules.
- Primary effects, recipient-specific Cleanse and global extras retain their ordering and frequency. Actor death during retaliation stops the same remaining work as today. Preserve target reuse across repeats, deployed-row order, swap action windows and reserve exclusions.
- Preserve all existing `action` event boundaries and fields. Feedback and audio consume these boundaries; event reordering can change visible sequencing even when final Health matches.
- Player play bookkeeping remains once per card, rather than once per repeat. Preserve hand overflow promotion, free-play consumption, Living Chorus and Resonant Chimes timing.
- Previews retain card resolution and final damage forecasts without publishing, saving, banking rewards or advancing the enemy turn. They leave the committed input and RNG untouched. Do not equate a preview with the complete committed result when settlement or automatic turn advancement occurs.
- Rejected commands retain the original state identity, RNG and empty event list. Accepted commands remain synchronous and immutable on publication.
- Keep save format and public command/event contracts unchanged unless evidence establishes a separate necessity. No development-save migration or legacy resolver will ship.

## Implementation sequence

### 1. Protect execution order at the command boundary

Read and extend the existing engine, combat, presentation and species suites before extraction. Build a compact set of fixed-seed scenarios that capture complete command results: accepted/rejected status, state, RNG and ordered events. Expected results must be derived from the current implementation and inspected for intended behavior, not generated from the new executor.

Cover both sides for ordinary attacks, random/all-target attacks, targeted/self/team healing, protection, swaps and repeat behavior. Concentrate additional cases on recipient Cleanse versus global extras, armor-break retaliation killing the actor, repeats losing their target, and player-only modifiers. Reuse current fixtures and nearby tests rather than creating a second all-species test framework.

Add command-level save/resume comparisons and assertions for preview non-mutation and settlement suppression. Preserve existing regressions in the species suites, hand-buffer tests and session tests. A genuine current defect discovered here gets a separate explicit behavior change and regression; do not silently incorporate it into expected-output updates.

Exit: the risky sequencing contracts have readable expected outcomes, and focused suites pass before moving execution code.

### 2. Make side policy and support decisions explicit

Introduce the internal side/context types alongside the shared execution owner. Keep `actionValue` and `enemyAbilityValue` as the existing magnitude policies. Replace the enemy extra-effect string allowlist with an exhaustive typed adaptation decision that explicitly retains, converts or excludes every supported kind. Make primary repertoire eligibility equally exhaustive, preserving selection order and all existing conversions.

Use an exhaustive switch with a `never` check, or an equivalently complete typed map. A new effect type must require an explicit support decision at compile time. Distinguish an intentionally ineligible enemy ability from an unimplemented effect; neither should fall through to Block.

Exit: existing content yields identical eligible enemy definitions in the same order, including conversion behavior, and adding an effect type requires explicit handling. Do not introduce selection-time RNG here.

### 3. Share primary effects and extras

Extract primary-effect execution and `applyExtras` under one owner. Replace positional booleans with named context/target information. Both callers supply their current computed values and targeting policy, and call exhaustive primary/extra handlers. Handle recipient extras during each healing recipient and global extras once at the existing point.

Keep repeat admission in the callers temporarily so this step stays reviewable. Keep special card-zone swaps and discard recovery behind narrow internal operations if needed; those operations must remain inside the same draft and preserve slot ownership.

Exit: each primary and extra effect has one execution implementation; both callers use it; the generic enemy Block fallback is gone. Fixed-seed results and existing species regressions remain unchanged.

### 4. Share the complete ability sequence

Move repeat admission, repeated-action events, per-repeat liveness checks and attack setup into the shared executor. Preserve the original relative timing of target selection, pre-play player procs and repeat rolls; a shared function must not normalize intentional differences. Leave command bookkeeping and turn scheduling outside execution.

Route player plays, previews and enemy actions through it. Remove the duplicate loops and temporary extraction scaffolding. Do not retain an old/new runtime flag or a parallel production resolver. Keep low-level talent/passive reactions in the existing combat helpers during this change.

Exit: `play` and `finishTurn` contain orchestration but no separate ability interpreter. Full command-result comparisons still match, including RNG and event order.

### 5. Verify consumers and document the boundary

Review the final diff for accidental balance changes, moved settlement checkpoints, RNG reordering and new import cycles. Update [Architecture](ARCHITECTURE.md) and the relevant ability-authoring guidance in [Content](CONTENT.md) with the actual execution owner and how to extend it.

Use existing [battle policy](../src/application/battle-policy.ts), [target previews](../src/ui/target-preview.tsx), inspection and feedback consumers to check the unchanged public contracts. Battle-policy scores remain heuristics; do not replace them with RNG-consuming execution or broaden this work into a UI rewrite.

Run the task-scoped check and focused affected unit suites under the [verification policy](../CONTRIBUTING.md#verification). Run the documentation gate for edited documentation. Integrate through the protected integration script. Full static checks, complete units, builds, browser journeys, replay and Windows package validation remain CI-owned and must be observed for the exact implementation commit. Review rendered combat evidence for action sequencing, previews, repeat feedback and automatic turn advancement when available; passing unit tests alone does not establish presentation quality.

Exit: exact-commit CI is green, relevant rendered evidence has been inspected, and any remaining desktop, physical-controller, Steam or Steam Deck verification is reported explicitly.

## Completion criteria

- One synchronous ability executor serves player cards, previews and enemy actions; primary and extra effects are handled exhaustively.
- Every authored effect has an explicit enemy-support decision. New effects cannot silently become Block or disappear from enemy extras.
- Seeded regression scenarios preserve full state, RNG and event ordering across the extraction, including save/resume. Preview-only settlement differences remain explicit.
- Mana, XP, card zones, rewards, progression and saves retain their existing authoritative owners and once-only behavior.
- No new dependencies, save migration, legacy resolver, asynchronous gameplay or broad combat-reaction rewrite is introduced.
- The implementation removes duplicated execution decisions. A smaller engine file alone is insufficient evidence of success.

## Evidence for this plan

The assessment inspected gameplay types, content/adaptation, engine validation and resolution, combat helpers, rules, save validation, session/cloud ownership, application battle policy, UI consumers and existing regression suites. This commit changes documentation only. It does not implement the refactor or establish runtime, balance, rendered or package validation; implementation gates above are future acceptance work.
