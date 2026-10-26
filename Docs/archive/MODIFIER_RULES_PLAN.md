# Make passive, Talent and Boon execution explicit

At the October 23, 2026 implementation handoff, source was integrated locally and hosted verification was pending. The [implementation record](../task-evidence/2026-10-23-modifier-contracts.md) owns the delivered changes and evidence scope. Current contracts remain in [Architecture](../ARCHITECTURE.md#modifier-ownership).

The final design uses immutable, type-checked module/export references and verifies them against production selectors and callers. Existing timing owners invoke their named functions directly; the ownership map does not add a runtime dispatcher. Boon parameters are shared with descriptions and visible assessments. The exact focused suite passes its pre-refactor comparisons after protected integration.

The [follow-through record](../task-evidence/2026-10-23-modifier-followthrough.md) adds shared Talent parameters and explicit deferred-effect producer/query/consumer bindings, preserving this canonical design. Its combined-runtime validation was deferred to CI at that handoff.

The original source assessment and proposed delivery sequence below are retained as history. They were written October 23, 2026 against committed local main `36da356f5ce60e2978af2eef44292aaff36867da`.

## Assessment

The largest remaining architectural weakness is **distributed ownership of gameplay modifiers**. A passive, Talent or Boon has an authored identity and description, but its executable contract must be reconstructed from conditionals across combat, card, journey and query owners. There is no exhaustive counterpart to the primary ability rule and handler catalogs that connects every modifier to its execution points.

This is a maintenance and change-safety finding from source inspection, not a reproduced player defect or measured performance problem. Existing modifier tests are substantial. The risk is that a new mechanic or timing change requires developers to discover all affected locations and preserve their implicit relationship.

Concrete evidence:

| Boundary                          | Current evidence                                                                                                                                                                                                                                                    | Consequence                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Authored rule versus execution    | [Dodge Talents](../../src/game/content/talents/dodge.ts) author identities and copy; [damage reactions](../../src/game/combat/damage-reactions.ts) independently encode Catch Breath's healing amount, prerequisites and position among reactions                   | Changing a number or trigger requires keeping two representations consistent           |
| One mechanic across timing points | Finding Rhythm increases in [damage](../../src/game/combat/damage.ts), resets in damage reactions and contributes to Dodge chance in [combat state](../../src/game/combat/state.ts)                                                                                 | The complete mechanic has no explicit list of required consumers                       |
| Passive dispatch                  | [Passive effects](../../src/game/content/types.ts) form a closed union, but consumers select individual kinds in [turns](../../src/game/combat/turns.ts), [card zones](../../src/game/card-zones.ts), [card actors](../../src/game/card-actors.ts) and other owners | Adding a union member does not require an execution or query registration              |
| Catalog validation                | [Content validation](../../src/game/content-validation.ts) checks passive amounts and six distinct tiers; Talent effect membership comes from the authored `TALENT_EFFECTS` list; Boon validation checks names and copy                                             | These checks do not establish an executable implementation for every authored modifier |
| Execution ordering                | Damage explicitly sequences depletion rewards, hit publication, damage rewards, buildup, procs, retaliation and control rewards                                                                                                                                     | Moving a rule to a plausible but different point can alter survival, events and RNG    |

I would prioritize this over further file splitting: the existing game/application/platform separation, lifecycle union, command transaction and synchronous combat scheduler already provide strong foundations. The recent [combat simplification](../task-evidence/2026-10-23-complexity-reduction.md) improved timing owners; this proposal adds completeness and feature ownership on top of them.

## Target design

Give each modifier a typed, discoverable implementation contract while keeping execution at explicit production timing points.

- Add closed catalogs keyed by passive effect kind, Talent ID and Boon ID, following the existing [ability rule contract](../../src/game/rules/contracts.ts). Every identity must name its actual query, reaction, setup or destination registrations. A modifier can have several registrations; Finding Rhythm must account for accumulation, reset and chance calculation
- Keep pure contracts and numeric rule parameters under the existing rules layer; keep mutation handlers under combat and destination behavior with its current owner. Catalog validation consumes pure registration metadata, never mutation handlers. Type-only content imports must preserve the existing rule-layer boundary
- Define narrowly typed timing contexts only where consumers need them: for example Dodge response, captured hit payment, successful control and turn end. Preserve phase-specific eligibility, packet origin, source attribution, captured payment facts and live combatant checks. A single unrestricted callback context would obscure those differences
- Keep ordered handler lists beside each timing owner. They reference registered handlers and preserve existing insertion points relative to core mutations and event publication. Do not derive execution order from catalog iteration, acquisition order or numeric priorities
- Reactions continue to yield the existing typed [combat operations](../../src/game/combat/operations.ts) through the depth-first resolver. Query-only modifiers remain pure selectors. Cross-owner dispatch must not introduce runtime import cycles, direct recursive combat calls or a global subscription bus
- Move shared balance parameters into their rule owner where copy and execution currently repeat them. Preserve exact displayed wording. Keep all six complete passive tier objects independently authored; the [withdrawn tier-authoring proposal](PASSIVE_AUTHORING_PLAN.md) does not apply here. A later tier can change mechanics and combine effects

Registration is an enforceable implementation map, not proof of correct behavior. It must reference real policies and handlers that production invokes; a free-text owner field or an uncalled no-op cannot satisfy completeness.

## Delivery plan

### 1. Inventory contracts and capture behavior

Map every passive kind, Talent and Boon to its current consumers, timing positions, allied/enemy scope, state lifetime, RNG decisions and description parameters. Include setup, card ownership, draw, cost, destinations and settlement; a combat-only inventory would be incomplete.

Before moving code, capture representative accepted-command traces from the old implementation: complete committed state, ordered events, RNG, current-format save/resume and preview outcomes. Reuse [combat resolution snapshots](../../tests/unit/game/combat-resolution.test.ts), [Boon tests](../../tests/unit/game/boons.test.ts), [passive tests](../../tests/unit/game/creature-passives.test.ts) and existing Talent regressions. Add mixed-modifier cases only where existing tests miss an ordering boundary. Retain authored catalog order and exact copy in the baseline.

**Exit:** every modifier has an identified implementation and verification path; comparison fixtures were recorded before extraction. Report any discovered gameplay discrepancy separately instead of silently incorporating a balance fix.

### 2. Prove the contract with Dodge

Extract Dodge-triggered reactions at the existing `dodgeResponse` positions. Include Catch Breath, cross-category triggers and Cindernewt's passive; their present relative ordering matters. Give Finding Rhythm explicit accumulation, reset and query registrations without routing its pure chance query through the mutation dispatcher.

Make this pilot a complete vertical slice: authored identity and parameters, registration, production invocation, description consistency and behavior coverage. Add negative contracts for missing registration, invalid timing context and forbidden imports.

**Exit:** the pilot preserves full state, ordered events, RNG and copy, including allied/enemy differences, nested reactions and an attacker knocked out during the response. Review whether the contract makes a modifier's consumers easier to find before extending it.

### 3. Migrate combat families in timing order

Move one existing family at a time: hit modifiers and rewards; Block/Armor depletion; healing and Leech; status/control; ability play/repeat; turn start/end. Give each rule one implementation and retain the old call position until its comparisons pass. Do not collapse interleaved steps into a broad “after damage” hook.

Preserve captured versus live facts, actor knockout cancellation, Death's Door, once-per-turn/battle flags, reserve attribution and player/enemy passive tiers. Triggered, direct and periodic packets retain their current eligibility and recursion restrictions. Recheck RNG short-circuiting after every family; equal final damage alone is insufficient.

**Exit:** migrated families no longer contain duplicate inline implementations; existing scheduler semantics and family baselines agree. Remove transitional paths as their consumers migrate.

### 4. Complete noncombat and query ownership

Register battle setup, card admission/cost/value, draw and overflow, fallen-owner cards, Legendary mechanics, Merchant pricing and settlement modifiers with their actual owners. Reuse pure policies in queries and execution when they represent the same fact. Preserve Auto-play's deliberate approximations and weights; uncertain previews must continue to replay production resolution with existing hidden-information and work-budget fallbacks.

Keep runtime state and save shape unchanged. Catalogs and execution metadata are derived, immutable data and never enter saves. If a necessary state-shape change emerges, review that change explicitly and update the development save version, validation and fixtures together; do not add legacy migrations.

**Exit:** every authored identity has complete registrations and a behavioral verification path, including query-only and destination-only rules. No blanket exemptions disguise unimplemented effects.

### 5. Enforce and document the boundary

Extend the existing [parser boundary checks](../../scripts/checks/boundaries.mjs) to cover extracted handlers under the same operation-yielding discipline. Add catalog-to-registration completeness and duplicate-registration checks, with declared multiple timing points permitted. Extend the existing [test ownership map](../../scripts/checks/test-owners.json) for the new files.

Update Architecture and Content with the modifier implementation procedure and one example spanning multiple timing points. Retire the temporary inventory once the checked catalogs own it; retain baseline evidence. Review the combined diff for cycles, redundant catalogs, unused abstractions and mechanical copy changes.

**Exit:** adding a new modifier requires its implementation contracts, and an ordinary same-trigger modifier can be added without editing unrelated combat families.

## Verification and completion

During implementation, run one exact focused regression under the current one-worker, 30-second local limit; narrow to the migrated behavior. Do not chain multiple suites or widen a timeout. Hosted CI owns compilation, broad modifier/combat coverage, deterministic replay, save/resume, browser and desktop checks. Use [Contributing](../../CONTRIBUTING.md#verification) and the protected integration gate for each delivered slice.

The decisive evidence is unchanged committed state, event order, RNG, authored copy and exact/uncertain preview behavior across the captured cases. Keep existing per-modifier tests; interaction fixtures complement them rather than replace them. Verify that previews leave their input state and live RNG untouched, and accepted commands still admit saves before publication. If presentation, copy or feedback changes, perform the [required rendered review](../UI.md#required-review) before integration.

Completion means all three modifier catalogs are exhaustive, production consumes their registrations, timing order remains explicit, transitional implementations are removed, and the hosted behavior comparisons pass. No performance improvement or visual parity is established by extraction alone. Report exact-commit CI, rendered inspection and native/device evidence separately.

This assessment and plan use source inspection only. No tests, builds, simulations or rendered captures were run to establish the finding. The first implementation milestone is the inventory, baseline and Dodge pilot; the remaining families are separate reviewable deliveries.
