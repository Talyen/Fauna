# Make combat reaction ordering explicit

Status: implemented; exact-commit hosted CI and rendered verification are reported in the task handoff

Assessment baseline: local main `25457b3`, 2026-10-21; subsequent main changes through `9178ce9` do not change the combat owners assessed here

## Finding

The largest architectural problem is that combat reaction policy is encoded in nested, mutually calling mutation helpers rather than an explicit resolution contract. A damage packet can grant protection, Cleanse, heal, deal more damage, break Armor, trigger retaliation and then resume an earlier calculation against changed state. Understanding one new passive requires understanding the call paths through the other effects.

This is a judgment about change risk and ownership, not a claim of a newly reproduced gameplay bug. The existing code handles many difficult interactions correctly. The problem is how much nonlocal reasoning is required to keep them correct as creatures, talents and Boons grow.

The recent [ability resolution work](COMBAT_RESOLUTION_PLAN.md) removed the separate player/enemy interpreters. Keep that shared executor. The remaining issue is below it: both sides now enter the same implicit reaction machinery.

## Evidence and priority

| Evidence                                                                                                                                                                                                             | Architectural consequence                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `hit` and `resolveHit` in [combat.ts](../../src/game/combat/index.ts) distinguish direct attacks, procs, periodic damage, retaliation, derived damage, bounces and Resonance with overlapping optional Boolean flags | Reaction eligibility is inferred from repeated flag combinations; callers can express combinations without a named gameplay meaning       |
| `resolveHit` invokes `healthThresholds`, nested `hit` calls, healing, status application and Armor-break reactions before returning the original Health loss                                                         | A parent calculation resumes after children have changed the same combatants; captured values and live values need different lifetimes    |
| `tickStatuses` captures Bleed payouts before damage and explicitly avoids restoring a status removed during a threshold Cleanse                                                                                      | Mutation order is part of the gameplay contract, but lives in local snapshots and defensive checks                                        |
| `triggerArmorBreak` is called from packet resolution, Purge, ability Armor melting and Leech Armor theft in [abilities.ts](../../src/game/combat/abilities.ts)                                                       | Detecting and delivering one semantic reaction is spread across several mutation paths                                                    |
| [combat-reactions.test.ts](../../tests/unit/game/combat-reactions.test.ts) protects one Molten Shell burst after Open Flank plus Erosion, persistent threshold Cleanse, and Bleed healing earned before Cleanse      | These are concrete examples of interaction cost; the tests establish intended behavior without establishing coverage of every combination |
| [combat-feedback.tsx](../../src/ui/battle/combat-feedback.tsx) consumes ordered committed events, while [session.ts](../../src/application/session.ts) saves and publishes a whole command result                    | Reordering reactions can change feedback, RNG and saved outcomes even when final damage appears equal                                     |

I rank this above the other candidates inspected:

- **Journey state typing:** [types.ts](../../src/game/types.ts) allows phase and nullable battle/reward/journey fields to disagree, while [save.ts](../../src/game/save.ts) reconstructs their relationships. Phase-specific types would help, but would not address the interaction ordering demonstrated above
- **App composition:** [App.tsx](../../src/ui/App.tsx) concentrates navigation, input and modal ownership. These responsibilities have an intentional single owner and feature components already exist; further splitting has less direct benefit to gameplay correctness
- **Platform and persistence layering:** gameplay is already isolated from I/O, and the application owns publication and serialized saving. Keep those boundaries

## Approved design intent

If retaliation knocks out the acting creature, stop its remaining hits and extra effects immediately, including remaining area targets and ability repeats. Check liveness after child reactions resolve and before continuing the acting creature's work. Already applied effects remain committed. Death's Door retaining the creature at 1 Health is not a knockout.

This rule was explicitly approved by the user. If current execution differs, record the correction separately from behavior-preserving restructuring and add a focused regression. Reaction-chain eligibility and the distinction between fully blocked attacks and Health damage retain current behavior; the other design suggestions have not been approved.

## Target architecture

Keep one synchronous Immer transaction per accepted command. Inside it, make combat resolution an explicit sequence of typed operations and continuations. The command still returns complete immutable state and ordered presentation events before saving or animation.

1. **Name packet provenance and eligibility.** Replace unconstrained flag combinations with discriminated origins covering the actual call sites: ability damage, supplemental damage, periodic damage, retaliation and derived damage. Represent bounce and Resonance ancestry explicitly where needed. First inventory existing combinations; this list is a starting design, not permission to collapse distinct behavior. One exhaustive policy owner determines eligibility for Dodge, Critical, attack modifiers, buildup, Leech and follow-up reactions. Keep precomputed Blind misses and Critical bonuses as data
2. **Separate committed facts from follow-up work.** Record actual Health lost, Block spent, Armor depletion and control application. Typed follow-up operations consume those facts. Capture earned quantities at their current semantic boundary; re-read Health, deployment, status and target eligibility where the existing rules require live state. Presentation `GameEvent` records remain output only and never become gameplay triggers
3. **Own nested execution explicitly.** A small combat resolution context holds the draft, event sink and an ephemeral stack of operations and resumable steps. Execute children depth first at the same point where the current helper calls them, then resume the parent with its captured result. A FIFO queue or a blanket rule that all parent events precede reactions would change behavior. Complete each root combat operation before the ability executor or turn scheduler proceeds
4. **Own depletion transitions.** Route Armor reductions that can cause a break through one mutation operation recording a positive-to-zero transition. Deliver each transition once at its existing reaction boundary. A later genuine Armor gain and break can produce a new reaction; a global once-per-command guard would be incorrect. Apply the same explicit observation discipline to Block depletion and threshold crossings

The stack, ancestry and intermediate results are transient execution data. They never enter `GameState`, saves, cloud payloads or UI state. The resolver cannot dispatch commands, settle rewards, publish, save or await. Root operations finish with no outstanding work.

Proposed ownership, with new modules under `src/game/` and filenames finalized during implementation:

| Owner                                                       | Responsibility                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `combat-policy.ts` (new)                                    | Packet origin types and exhaustive reaction eligibility                                           |
| `combat-resolution.ts` (new)                                | Synchronous operation stack, continuations and reaction ordering                                  |
| Existing [combat.ts](../../src/game/combat/index.ts)        | Focused calculations and public combat entry points, delegating nested execution to the resolver  |
| Existing [abilities.ts](../../src/game/combat/abilities.ts) | Ability targets, repeats, primary effects and extras; every root effect completes before the next |
| Existing [engine.ts](../../src/game/engine.ts)              | Validation, Mana, card zones, XP, turn windows and once-only battle settlement                    |
| Existing application and presentation                       | Save/publication ordering and consumption of committed results                                    |

Keep dependency direction one way: public combat entry points call the resolver; the resolver consumes lower-level policy/calculations. Do not create a combat/resolver import cycle. Add modules only for concrete responsibilities; splitting the large file alone is not success.

## Implementation sequence

### 1. Record the current contract

Inventory every packet call site and legal flag combination, including extra ability damage, status ticks, reflected statuses, Armor theft, Purge and noncombat healing. Write the packet eligibility table and existing step order, including child effects occurring before the parent's damage event. Record captured quantities and values re-read after each child.

Retain existing reaction/species tests. Add only missing combined-reaction and command-trace coverage. Capture reviewed baseline state, RNG and ordered events for a small deterministic corpus before changing execution. Pair fixtures with named player-outcome assertions so implementation details do not become the only oracle. Use no duplicate production interpreter.

Exit: every existing packet form has an explicit meaning and sensitive ordering cases have executable coverage. Resolve an unclear rule before changing its path.

### 2. Introduce typed packets without changing execution

Replace Boolean classification at call sites with typed packets and exhaustive eligibility decisions, retaining current call order. Distinguish a miss/no packet from a landed zero-Health-loss packet in the internal result type; exact Block absorption still matters to passives. Convert consumers together while preserving public behavior.

Exit: no arbitrary packet flag bag remains in the converted path, and command results match the baseline, including RNG and ordered events.

### 3. Move nested damage into explicit continuations

Move damage resolution and nested damage reactions into the synchronous resolver, one reaction family at a time. Keep current points for Dodge, thresholds, mitigation, event emission, buildup, supplemental packets, retaliation and Armor breaks. Store the parent's actual Health loss and other earned facts in its frame rather than recomputing after children.

Begin with direct/supplemental/periodic packets, then migrate retaliation, Armor bursts, bounce, Resonance and reflected-status children. Revalidate liveness and deployed rows at the same boundaries as today. Prove each family's termination through eligibility/ancestry rules, visited recipients or consumed resources. A silent depth limit dropping valid effects is not an acceptable loop fix.

Exit: migrated damage reactions cannot recursively re-enter packet mutation helpers; results and event interleaving remain identical. Temporary adapters serve only unmigrated callers and disappear in the next step.

### 4. Bring protection, healing and statuses under the same owner

Convert threshold grants, Cleanse rewards, Leech, healing bounce, protection sharing, status reflection and depletion delivery into typed operations in the same context. Preserve context-free Campfire recovery and distinctions between card healing, ordinary healing and revival. Centralize Armor-transition detection across damage, Erosion, Purge, control, theft and extras without changing delivery timing.

Remove adapters and superseded guards only after the resolver expresses and tests their rule. Ancestry rules must permit legitimate repeats and repeated real depletion.

Exit: the combat reaction graph has one owner. Adding a reaction requires an explicit trigger, eligibility, insertion point and termination rule. Calculation helpers cannot secretly schedule child gameplay work.

### 5. Verify the combined behavior and retire the old path

Review the complete diff for duplicate policy, changed RNG consumption, event ordering and stale combatant references. Confirm the resolver drains before settlement or the next ability/turn step. Keep command, preview, event and save contracts unchanged. Update architecture documentation; remove any baseline-generation helper while retaining valuable regression fixtures.

## Acceptance and verification

Require exact state, RNG, acceptance/rejection and ordered-event equality for the baseline corpus, except for separately documented corrections needed to meet the approved knockout rule. Do not regenerate expectations to hide a mismatch. A separately demonstrated existing bug needs a focused regression and an explicitly documented behavior change, rather than a broad balance adjustment.

Required coverage includes:

- Both sides and player-only exceptions; ability extras; primary and supplemental room scaling exactly once
- Misses, zero damage, exact Block absorption, mitigation, overkill and Death's Door
- Open Flank plus Erosion causing one Armor break; opposing Molten Shells; genuine Armor regrant/break causing another reaction; Purge, theft and control-based Armor removal
- Last Resort during Burn/Poison/Bleed ticks; captured Bleed Leech paid once after Cleanse; decay never restoring a removed wound
- Dodge and reflection; bounce and Resonance; retaliation eligibility and termination; actor/target knockout during children
- Retaliation knocking out the acting creature cancels its remaining hits, area targets, extra effects and repeats on both sides, without undoing applied effects; Death's Door survival permits continuation
- Healing/protection sharing without amplification; reserve exclusion; live deployed-row checks after swaps; repeat and area-target cutoffs
- Rejected commands retaining original identity/RNG; detached previews resolving the same effects without settlement; identical command continuation after save/resume
- Once-only rewards after the complete chain; synchronous completion; unchanged command/save/publication ordering

Use existing focused suites, especially [combat](../../tests/unit/game/combat.test.ts), [combat reactions](../../tests/unit/game/combat-reactions.test.ts), [Molten Shell](../../tests/unit/game/molten-shell.test.ts), [Coralcurl](../../tests/unit/game/creatures/coralcurl.test.ts), [Captoad](../../tests/unit/game/creatures/captoad.test.ts), [abilities](../../tests/unit/game/abilities.test.ts), [swapping](../../tests/unit/game/swapping.test.ts) and [presentation](../../tests/integration/gameplay/presentation.test.ts). Extend relevant owners rather than creating a parallel hierarchy. Include application save-ordering regressions in the implementation's focused selection.

Follow [Contributing](../../CONTRIBUTING.md#verification): task-path checks and useful named unit suites locally; documentation checks for Markdown. Full static checks, all units, build, browser/replay and Windows packaging remain CI-owned. For implementation, observe CI for the exact integrated commit and inspect combat feedback evidence because event order is player-visible. Report desktop, physical controller, Steam client and Steam Deck boundaries separately; unrun checks remain pending.

The original assessment changed documentation only. The implementation record below identifies runtime changes and the local verification boundary.

## Scope and stopping conditions

Add no dependency, generic event bus, plugin framework, ECS, asynchronous combat or event-sourced save format. Do not redesign journey state, UI navigation, content values or the shared ability executor. No save migration or format change is needed if the transient design is respected; any unforeseen persisted change follows the disposable-development-save policy.

Deliver the steps as reviewable commits in order, retaining a working implementation at each boundary. Stop converting a reaction family if its semantics cannot be explained or its seeded baseline diverges. Finish when reaction order and eligibility have one explicit owner, old recursive execution paths are removed, and the combined result meets acceptance gates. File count or line-count reduction is not the measure of success.

## Implementation contract inventory

Baseline for implementation: `8b37595`. Four deterministic command traces in the combat-resolution suite capture complete command-result hashes, RNG and save/resume equality before conversion.

| Packet origin                            | Attack modifiers and buildup | Dodge / Critical / direct triggers | Extra eligibility                                                                                |
| ---------------------------------------- | ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Ability, including authored extra damage | Yes                          | Yes                                | Wrong Foot on initial delivery; Resonance; Light bounce                                          |
| Supplemental proc                        | Yes                          | No                                 | Resonance; Light bounce                                                                          |
| Resonance copy                           | Yes                          | No                                 | No further Resonance                                                                             |
| Periodic tick or Rupture                 | No                           | No                                 | Bypasses Block; may retain a knocked-out source's attribution                                    |
| Retaliation                              | No                           | No                                 | Ordinary retaliation has no buildup; status retaliation explicitly builds it                     |
| Derived control/depletion damage         | No                           | No                                 | Existing source-death permission retained; ability continuation still stops after actor knockout |

Bounced delivery retains its parent packet's attack policy, forbids another bounce and excludes Wrong Foot. Blind is captured once per ability resolution; a direct bounced packet uses the same captured miss. Resonance retains the original damage value and Leech metadata. Shared protection forbids resharing; healing bounce does not pass its source to child heals; status reflection forbids a second reflection. These are distinct termination rules, not a global reaction limit.

The packet sequence is: admission; Dodge and its reactions; Freeze Nullify; attack modifiers; Critical; Block payment; Armor modifiers and mitigation; Health payment and Armor decay; threshold reactions; Sun-Struck Shield; Second Wind; Block/damage/knockout events; earned Gold/healing and Boon effects; Open Flank; Water talents; buildup and control grants; attack procs; Thorns; Leech; control rewards; Sporecoat; Bubble Burst; Armor-break delivery. The outer hit then resolves Wrong Foot, Resonance and Light bounce. Each child completes at its insertion point before the parent resumes.

Captured facts include actual Health loss, Block spent, initial Armor, pending Armor breaks and Bleed payout ownership. Threshold Cleanse can remove the ticking wound without revoking already earned Leech. Liveness and reaction eligibility are rechecked on continuation; approved actor knockout cancels unexecuted ability work without rolling back completed facts.

## Implementation record

All five implementation stages are complete. `combat.ts` retains public entry points; `combat-policy.ts` names packet origins and eligibility; `combat-resolution.ts` uses generator frames as typed continuations on a synchronous local stack; `combat-state.ts` supplies atomic mutations and queries. Children yield one operation to the stack and never recursively enter another mutation handler. State, RNG and event ordering remain owned by the existing command transaction. Architecture checks protect the dependency direction and keep direct resolver access out of presentation.

Armor reductions now use one atomic owner and transient depletion receipts, including damage decay, Erosion, control removal, Purge, melting and theft. A receipt is consumed before its reaction runs; a new Armor gain and break can produce another receipt. Internal packet results distinguish ignored/missed packets from landed packets with zero Health loss. Neither change alters the saved aggregate or format.

The approved knockout correction is recorded separately: Thunderstone previously dealt its derived follow-up after Thorns had knocked out the acting creature. It now stops. Later proc checks also stop consuming RNG after a prior child kills the actor, and pre-ability Armor-break knockout stops repeat admission. Regressions protect both sides' area targets, extra effects and repeats, plus Death's Door continuation. Applied damage/control and independently earned periodic attribution remain intact.

All four pre-refactor deterministic traces still match their recorded complete-result hashes exactly. The focused local selection passed 534 tests across 27 combat, species, presentation and application save-ordering suites before the final architecture-policy check. Two Boon fixtures were corrected to pair Freeze with a positive control duration and clear it when control is removed, matching the existing current-format validator. No gameplay save schema change was needed. Full CI, build, browser/replay, Windows packaging and rendered evidence remain separate gates; the task handoff records observed results.

The final browser gate exposed an existing shared victory-fixture inconsistency: Stun was set without a positive control duration, so startup silently rejected the checkpoint. The fixture now sets coherent durations and a unit regression verifies resume before the final play. Concurrent Recruit-destination work advanced the development save format to 43; the combat oracle pins only its format metadata to the original value 42 while save/resume checks validate the actual current format. All original combat hashes remain unchanged without recapturing expected outcomes.

Hosted CI for `7f54744` passed full static checks, all 2,220 unit/DOM tests, production build, Windows packaged smoke and interaction replay; browser completion was blocked by the shared victory fixture corrected above. The combined `8e71051` additionally contained parallel Recruit/Boon Merchant and recovery work. Its build measured 723,971 bytes, 3,165 more than the reaction-only 720,806-byte build, exceeding the former allowance. The measured baseline and roughly 7.5% headroom policy were documented together in the script owner. Two newly merged test fixtures also needed type-only corrections. Final combined CI and rendered acceptance remain tied to the commit named in the handoff.

Final combined CI also required synchronizing existing fixtures with current support-room rules: clearing Stun clears its duration, Campfire is unavailable immediately after a Rest, and the shared full-journey seed is 98 after optional destination offers changed RNG consumption. Its command-level regression reaches victory in 382 commands, retaining the existing 400-command browser bound, full roster, final-boss and save/resume assertions. The temporary seed-search helper was removed.

The final viewport review found the new Recruit kit tooltip extending below the screen at 1280×720 with enlarged text. Recruit details now request the existing Radix right-side placement through a typed CreatureCard prop, preserving collision handling, typography and content. The zero-Mana browser fixture also clears the paired control duration. The existing browser journeys retain their save/resume and full-content viewport assertions.

Parallel commit `91556d0` corrected Meteorite so triggered Burn cannot consume or receive the next direct-Burn bonus. The existing focused Boon regression proves the rule. Temporarily restoring the old `attack` guard made the original bounce/healing trace pass but failed that Meteorite regression; restoring `direct` passed the regression and changed that one trace. Only the bounce/healing oracle was recaptured for this demonstrated rule correction. The other three original traces remain unchanged, and every current command still matches its save/resume continuation. The stale talent-test import was already corrected by the parallel work.
