# Make journey lifecycle states explicit

Status: implemented; exact-commit CI and rendered evidence are reported in the task handoff

Assessment baseline: local main `e701315`, 2026-10-21

## Original finding

The biggest remaining architectural problem is that the journey lifecycle has no single structural contract. `GameState` stores a phase alongside independently nullable battle, reward, expedition, support and journey objects. Commands construct their relationships procedurally; save decoding reconstructs those relationships separately. The type system permits combinations that neither commands nor loading should accept.

The sharpest example is `battle`: it means both an active simulation and a completed battle receipt. Recruitment must maintain the defeated enemies and card zones so that the old battle still passes validation after the player's roster changes. A future reward or roster change therefore needs knowledge of combat internals and save rules.

This is an assessment of change risk, not a newly reproduced player bug. Existing deterministic replay, save round-trip and backup recovery tests provide valuable protection. The goal is to make those guarantees easier to preserve as destinations and rewards grow.

## Evidence and priority

| Current owner                                                                                           | Evidence                                                                                                                                                        | Consequence                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [GameState](../src/game/types.ts)                                                                       | `phase` is independent of nullable `battle`, `reward`, `journey`, `expedition` and `support`                                                                    | A battle without combat data, or a reward choice without a reward, is representable                                   |
| [Command engine](../src/game/engine.ts)                                                                 | `resolve` validates phase combinations before a separate mutation switch; recruitment patches card definitions, defeated enemy targets and settled card zones   | Command admission and transitions rely on nonlocal assumptions; reward handling maintains combat history as live data |
| [Journey lifecycle](../src/game/journey.ts)                                                             | `finishBattle`, `enterReward` and `afterRewards` coordinate phase, reward, battle, encounter and summary changes; completed battles survive reward choice       | The same field crosses different lifetimes without its type changing                                                  |
| [Save decoding](../src/game/save.ts)                                                                    | Structural schemas allow independent nulls; later checks reconstruct phase requirements, outcome consistency, enemy targets, card ownership and zone membership | Persistence acts as a second implementation of lifecycle validity                                                     |
| [Rewards](../src/ui/expedition/rewards.tsx) and [Auto-play policy](../src/application/battle-policy.ts) | Rewards asserts `game.reward!`; Auto-play checks both phase and battle presence                                                                                 | Consumers must recover guarantees the state contract could supply                                                     |
| [Save boundary regressions](../tests/unit/game/save-boundaries.test.ts)                                 | Cases cover a victory receipt presented as a returned journey and final victory presented as a Boon choice                                                      | Contradictory lifecycle combinations already merit explicit regression coverage                                       |

I rank this above the other candidates inspected:

- Combat interaction complexity is substantial, but [packet policy](../src/game/combat/policy.ts), [typed operations](../src/game/combat/operations.ts) and the [synchronous resolver](../src/game/combat/resolution.ts) now give it explicit ownership. Preserve that work
- The [game shell](../src/ui/shell/game-shell.tsx) combines navigation, commands and focus restoration, but these have an intentional single owner and extracted consumers. Further splitting does less to protect gameplay and resume correctness
- The [application session](../src/application/session.ts) already admits saves before publishing state and drains admitted writes on disposal. Gameplay is isolated from platform capabilities. Retain these boundaries

## Target contract

Keep one synchronous, deterministic command transaction. Represent lifecycle alternatives as a discriminated union whose phase determines its required payload. Narrow a state once, then pass the appropriate variant to its consumers.

| Lifecycle variant      | Required data and lifetime                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Draft                  | Starter choices and offers; no active battle or pending battle reward                                                 |
| Team selection         | Current journey, lineup and destination offers; no active battle                                                      |
| Campfire               | Current journey and Campfire context; no active battle                                                                |
| Merchant               | Current journey and the exact visit and stock being used; no active battle                                            |
| Battle                 | Active battle with enemies, zones and combat state; no pending reward                                                 |
| Recruit or Boon choice | Current roster, the corresponding pending choice and a completed battle receipt; no active battle                     |
| Victory or defeat      | Completed journey result and the applicable receipt; returning voluntarily is distinct from defeat in the result data |

Keep the current player-facing phase labels where useful. The table describes required relationships, not final field names. Destination offers may remain available across team selection, Campfire and Merchant states according to today's rules; an available visit is different from an active visit. Voluntary return can happen before any battle has completed, so a terminal result must not require a battle receipt in every case.

A completed battle receipt contains earned XP, currency, outcome and the offer data needed by reward selection and results. Historical combat detail belongs there only when an actual consumer needs it. It must not reference the current roster in a way that requires rewriting defeated enemies when a recruit joins. If a historical roster snapshot is necessary, capture detached plain data at settlement.

One journey transition owner constructs the destination variant when starting combat, settling it, consuming a reward, leaving a destination or returning home. Combat helpers update the active battle; they do not own journey progression. Save decoding validates the same variant shapes and retains semantic checks for identifiers, quantities, references and content eligibility. Types cannot replace validation of untrusted saves.

Do not introduce an event bus, asynchronous gameplay queue, state-machine library, entity framework or event-sourced save format. Committed presentation events remain output only. Do not combine this work with normalizing roster storage, redesigning combat effects, changing balance or removing standalone encounter fixtures.

## Implementation sequence

### 1. Record the lifecycle behavior to preserve

Build a transition table from the actual command handlers, including allowed commands, required data, resulting phase and RNG use. Include global commands such as talent purchases and resets, development-only commands, and every legal return path. Record preview as a separate execution mode: it deliberately skips settlement and automatic turn completion and must never become a persisted lifecycle variant.

Strengthen existing focused suites rather than duplicate the full expedition matrix. Capture representative seeded command sequences covering starter completion, combat, recruitment with and without replacement, Boon choice, Campfire, Merchant purchase and departure, victory, defeat and voluntary return. Include duplicate-species rosters and changes to starting lineup during reward choice. Compare complete states, RNG and ordered events across refactor steps while the old shape exists.

Exit: the transition table has no unclassified command, and the representative corpus records current acceptance, rejection and progression behavior. Separately demonstrate any actual defect before changing expectations.

### 2. Separate live combat from its receipt

Introduce an explicit completed battle receipt and make settlement capture it exactly once after banking XP and currency. Move reward choice and results consumers to that receipt. Clear active combat when settlement finishes. Remove recruitment's updates to defeated enemy targets and settled card zones once those historical objects have no consumer.

Update save shape, version and affected development fixtures together. Follow the disposable-save policy: reject obsolete formats, retain current-format backup recovery and add no migration. Existing historical snapshots, if retained, must validate within their own identities rather than against the newly changed roster.

Keep the command transaction atomic: do not publish or enqueue a save between currency banking, receipt creation and entering the next phase. Preserve same-command Auto-end turn behavior, defeat checks, reward offers and RNG consumption. After a terminal combat operation, no caller may continue using the former active battle.

Exit: selecting or replacing a recruit changes the current roster without repairing completed combat data; loading a save on each reward screen preserves the pending choice without granting XP or currency again.

### 3. Make phases carry their data

Replace the flat lifecycle fields with the union described above. Keep genuinely shared progression data outside the variant. Use named state constructors and an exhaustive transition owner in the game layer; keep command-specific rejection checks next to the transition or operation they protect, before mutation and RNG consumption.

Give combat entry points an active-battle type and reward entry points their reward variant. Keep `dispatch` as the single public command authority. Small narrowing/query helpers may support shared UI, but must not rebuild the old nullable bag or turn missing required payloads into silent defaults. Mutable drafts stay inside the synchronous transaction; committed data stays detached and frozen.

Choose a single owner for structural variant schemas and their types, with type-only dependencies where necessary to preserve import boundaries. Prefer deriving types from those schemas where practical; otherwise enforce schema/type equivalence at compilation. Retain cross-reference validation as explicit semantic rules rather than duplicating transition execution in the decoder. This does not require running Zod parsing on every gameplay command.

Exit: a battle variant without active combat and a reward variant without its choice fail compilation and decoding. Validated phase-specific consumers no longer need assertions to recover those payloads. Rejected commands preserve the original state object and RNG.

### 4. Move consumers and fixtures to the contract

Adapt Auto-play, previews, reward screens, results, deck inspection, tooling and scenario builders to narrow the variant or consume a small explicit query. Keep navigation and modal ownership in the shell. Do not make React effects settle combat or reconstruct missing lifecycle state.

Preserve standalone encounter scenarios through explicit fixture construction; do not expand production compatibility to accommodate old test shapes. Finish the development save version and fixture changes with each coherent schema change. Temporary adapters must have named callers and be removed before completion.

Exit: no production or fixture path fabricates a phase/payload mismatch; a save resumed at every legal boundary presents the same available player action as the uninterrupted journey. Preview remains unpublished and unsaved.

### 5. Review the combined change and verify

Compare the seeded corpus against the original behavior using a deliberate mapping for removed redundant fields and new receipts. Require equality of accepted/rejected commands, RNG, ordered events, resources, roster, available choices and progression. Do not regenerate expected outcomes to conceal divergence. Add focused regressions for semantic rules that moved, keeping existing recovery and lifecycle tests.

Update [architecture](ARCHITECTURE.md), the save contract and affected fixture documentation. Review all field writers and callers for old receipt mutation, duplicate settlement, stale battle references and command guards that consume RNG. Remove obsolete shapes and adapters before integration.

## Acceptance and verification

The change is complete when:

- Phase determines the presence and lifetime of active combat, pending rewards and terminal results
- Completed receipts do not require mutation when the current roster or lineup changes
- Settlement banks rewards once, including across save/resume and repeated rejected commands
- Every supported phase round-trips through the current save format; malformed payloads and references are rejected and a valid backup recovers silently
- Seeded outcomes, event ordering, resource totals, Auto-end turn and preview isolation retain their behavior
- Session save admission, synchronous publication, retries, command revocation and shutdown draining retain their existing guarantees
- Structural phase relationships have one canonical contract; semantic save validation remains intact

Follow [verification policy](../CONTRIBUTING.md#verification). Run path-scoped local checks and focused unit suites appropriate to each step; run documentation checks for document edits. Full static/type checks, unit/DOM suites, build, browser journeys and packaging remain CI-owned. Observe CI for the exact implementation commit, including rendered reward, results, roster, menu and resume evidence when presentation consumers change. Browser simulation does not establish native desktop, Windows packaging, physical controller, Steam client or Steam Deck behavior.

Integrate each coherent, reviewed and verified slice through the shared repository lock. Each intermediate commit must have one supported current save format, passing relevant checks and no partially wired transition. If a slice cannot meet that condition, keep it on the task branch until it can; do not ship an adapter that quietly accepts contradictory lifecycle state.

## Implementation record

The shared structural contract lives in [state-schema.ts](../src/game/state-schema.ts), with types inferred in [types.ts](../src/game/types.ts). [journey.ts](../src/game/journey.ts) owns complete lifecycle transitions. Live combat ends at settlement, while the journey retains a detached receipt containing encounter, outcome, XP and currency. Pending rewards retain offers and earnings without enemy identities or card zones. Recruitment no longer patches historical combat. Current development saves use version 45; obsolete saves are rejected without migration.

The [phase table](../src/game/command-phases.ts) covers every command. Command-specific conditions still validate before mutation or RNG use. Global talent commands retain their existing rules in every phase. Preview remains an unpublished execution mode and skips settlement and Auto-end turn.

| Command             | Allowed phases                                       | Result and RNG behavior                                                                                          |
| ------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Draft               | Draft                                                | Adds a starter and rerolls offers until complete                                                                 |
| Start               | Draft                                                | Enters team selection; prepares seeded destinations                                                              |
| Begin battle        | Team selection                                       | Enters battle; initializes seeded draw and targets                                                               |
| Set lineup          | Team selection, Recruit, Boon, Campfire, Merchant    | Updates the next starting lineup; no RNG                                                                         |
| Swap                | Team selection, battle                               | Exchanges an active creature and backup; manual swap retains zones and RNG                                       |
| Play                | Battle                                               | Resolves the ability and reactions, then settles or completes a turn when applicable; seeded effects consume RNG |
| End turn            | Battle                                               | Resolves enemy actions and statuses; settles or starts the next seeded player turn                               |
| Development victory | Battle, with development capability                  | Settles the current battle using ordinary reward rules                                                           |
| Visit Campfire      | Team selection                                       | Enters Campfire with the existing destination offers; no RNG                                                     |
| Rest                | Campfire                                             | Restores Health and returns to the same destinations; no RNG                                                     |
| Leave Campfire      | Campfire                                             | Returns to the same destinations; no RNG                                                                         |
| Enter Merchant      | Team selection                                       | Enters the exact offered visit; no RNG                                                                           |
| Buy Boon            | Merchant                                             | Spends currency and resolves the exact stock slot once; no RNG                                                   |
| Leave Merchant      | Merchant                                             | Completes the visit and prepares seeded destinations at the same encounter                                       |
| Recruit             | Recruit                                              | Adds or replaces the selected creature, consumes the reward and prepares the next seeded encounter               |
| Recruit destination | Team selection                                       | Consumes the saved offer without advancing the encounter or RNG                                                  |
| Skip Recruit        | Recruit, only when there is no offer                 | Rejected for all current valid Recruit states, which require an offer                                            |
| Choose Boon         | Boon                                                 | Grants the selected Boon and prepares the next seeded encounter                                                  |
| Skip Boon           | Boon                                                 | Consumes the choice and prepares the next seeded encounter                                                       |
| Buy talent          | All phases                                           | Uses the existing progression eligibility and point rules; no RNG                                                |
| Reset talents       | All phases                                           | Removes the purchased category; no RNG                                                                           |
| New run             | Draft, victory, defeat                               | Retains permanent progress and prepares offers from the supplied seed                                            |
| Abandon             | Draft with a selection, or any ongoing journey phase | Clears draft choices and rerolls offers, or banks pending XP and records voluntary return without a new reward   |

The retained Skip Recruit command remains rejected for current valid saves; removing its public command is outside this behavior-preserving refactor. Available destination offers and active Merchant context remain separate lifetimes. Voluntary return preserves completed earnings without pretending to be a combat defeat.

[Lifecycle regressions](../tests/unit/game/journey-lifecycle.test.ts) retain three seeded command and output baselines captured before the runtime changes, plus required phase type checks, save payload rejection, detached recruitment receipts, duplicate settlement rejection and return/resume coverage. Baseline normalization excludes the save version, obsolete completed battle objects and out-of-combat Block/status fields; it compares the original earnings fields of last-battle receipts while dedicated tests cover their new encounter and outcome fields. No baseline expectations were regenerated after refactoring. Scenario builders explicitly construct destination states, including journey counts, instead of manufacturing inconsistent phase and payload combinations.

Two terminal digests in the older combat-resolution corpus were recalculated with the normalized projection against the committed pre-refactor engine (`af55a6b` parent), then verified unchanged against the new engine. Live combat digests and their recorded RNG and commands remain unchanged. This preserves the original behavioral oracle while excluding the retired battle object and newly required summary.

The application save queue, publication and disposal owners remain unchanged. Battle, reward and earnings presentation consume the explicit contract; layout, input behavior and focus owners retain their existing implementation. Full CI owns type, lint, unit/DOM, build, rendered browser and packaged Windows verification.
