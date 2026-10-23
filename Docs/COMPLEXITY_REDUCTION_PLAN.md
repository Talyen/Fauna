# Further codebase simplification

Assessment date: October 23, 2026. Source baseline: `f0d462e9bddb74d15668a132ca253ac64620447c` on local main; findings rechecked against main through `18e54964e6ab32cf999e19e9824b4dad2c6e9894` during integration. This is a proposed implementation plan; this assessment changes documentation only.

The main cost is reasoning about combat order and battle interaction, not file length. Reduce duplicated interpretations and coordinated writes without adding frameworks.

Retain the [recent simplification](archive/SIMPLIFICATION_IMPLEMENTATION.md): one journey, authoritative creature arrays, no unreachable reveals, explicit navigation, lifecycle union, shared ability executor and combat stack. This proposal works within those owners.

## Priorities

Address damage and status ownership first, then targeting and Auto-play; make supporting identity/read-access changes within those stages. The [delivery sequence](#delivery-sequence) records dependencies and gates once. Confidence is high in the observed structural costs; maintenance benefit is a judgment, not a reproduced bug or measured speedup.

## Shared safeguards

These apply to every stage; the acceptance lists below add boundary-specific requirements.

- Preserve complete command results: acceptance/rejection, ordered events, RNG and final state. Capture baselines before runtime edits; investigate pre-existing failures separately and never refresh golden results to hide unexplained divergence
- Keep one synchronous command transaction. Calculations and transient payment facts do not become saved continuations, event-triggered gameplay or asynchronous combat
- Keep each slice working and independently reviewable; remove superseded code, dual implementations, compatibility shims and partial conversions before completion. Split demonstrated gameplay fixes into separate changes with regressions; identify/version intentional ranking changes and assess them with paired balance runs
- Stop when captured versus live values or deterministic differences cannot be explained. Add no dependencies, generic rule language, plugin/stage framework, ECS, universal registry or rewritten runner merely to shorten files
- Preserve current-format semantic validation. A persisted-shape change updates schema, version and fixtures together and rejects obsolete development saves without migrations. Normalize only the explicitly changed representation/version in parity comparisons; test decoding separately
- Follow [verification and protected integration](../CONTRIBUTING.md#verification) and [rendered review](UI.md#required-review). Source inspection cannot establish performance or visual parity; retain task evidence and report actual CI/platform boundaries

## 1. Make damage resolution readable in execution order

### Evidence

[Damage resolution](../src/game/combat/damage.ts) already uses the typed generator stack correctly, but its `resolveHit` handler (lines 148–585 at the assessment baseline) interleaves:

- Admission, Blind/Dodge and Dodge talents at the beginning of `resolveHit`
- Offensive modifiers, target modifiers, deployed resistance auras and rounding
- Critical state consumption, Block payment, Armor erosion and Health loss
- Threshold reactions before Block/damage event publication
- Gold, healing, Boons, Water follow-ups, harmful buildup and attack procs
- Thorns, Leech, control rewards, creature retaliation and deferred Armor-break delivery

`damage` changes meaning from modified attack to post-Critical and post-mitigation value; `lost` is actual Health removed. Reinforce distinguishes `blocked` from `blockSpent`. Armor depletion receipts are collected at several points for later delivery. Their variable lifetimes obscure these real distinctions.

[Reaction regressions](../tests/unit/game/combat-reactions.test.ts) protect Block spent versus amplified absorption, Last Resort preserving earned Leech after removing a wound, and child reactions knocking out an actor before continuation.

### Proposed design

Risk is high: RNG, rounding and reaction order are observable. Retain [packet policy](../src/game/combat/policy.ts), [typed operations](../src/game/combat/operations.ts) and the [depth-first scheduler](../src/game/combat/resolution.ts).

1. Make the coordinator show the current sequence as direct calls/generator delegations: Dodge response, offensive arithmetic, mitigation, defense/Health payment, attack procs and retaliation. Use named functions without runtime sorting
2. Extract pure arithmetic over current combatants, packet eligibility and explicit attack facts. Return numeric facts without RNG, consumed flags, mutations or events; preserve rounding and expression order
3. Capture Health before payment, Health lost, damage absorbed, Block spent, Critical result and pending Armor depletions; pass these transient facts only to stages that need them
4. After yielded children, re-read Health, status, deployment and continuation eligibility at the existing boundaries. Do not cache talents, auras or combatants across reactions to shorten arguments
5. Extract ordered attack-proc families, checking actor liveness before each later roll. Use tables only for identical leaf rules; differing timing/payout semantics stay explicit
6. Keep the outer `hit` owner's Wrong Foot, Resonance and bounce sequence visible and separate. Preserve `ignored`, `miss` and `landed` with zero Health loss as distinct results
7. Remove inline implementations as each group moves; helpers must clarify inputs and timing rather than merely relocate code

Use narrow immutable calculation/payment results. Introduce a small invocation record only for repeated arguments, not a giant mutable hit context.

### Acceptance

- A reviewer can read `resolveHit` and identify the complete stage order without traversing talent implementations
- Only the arithmetic owner defines ordinary outgoing/incoming damage formulas; callers do not reproduce mitigation
- Threshold Cleanse, Block replenishment during reactions, Armor regrant/rebreak, fully absorbed Critical hits, reflected control, attacker knockout, Death's Door, bounce and Resonance retain their current behavior

The main risk is moving calculations across child reactions; compare deterministic traces after each extracted family.

## 2. Give status transitions one bookkeeping owner

### Evidence

[CombatState](../src/game/types.ts) mixes status magnitudes, attribution, deferred payouts, control phase, one-use permissions and per-turn counters in one flat structure. Its shape is also separately declared in [the save schema](../src/game/state-schema.ts) and initialized in [freshCombat](../src/game/combat/state.ts).

Coordinated mutations are the problem:

- Active control uses `controlled`, `controlTurns`, `cooldown` and `skipped`. Application lives in [statuses](../src/game/combat/statuses.ts); expiration lives in [startAction](../src/game/combat/lifecycle.ts); Cleanse has a third multi-field transition; [save validation](../src/game/save.ts) reconstructs their coherence
- Burn, Poison and Bleed amounts have parallel `statusSources`; Bleed also has ordered `bleedLeech` obligations
- Clean Getaway directly reduces stacks and trims Bleed payouts in [damage](../src/game/combat/damage.ts). Ordinary Cleanse clears them in `removeEffects`. Ticking captures payouts and decays stacks in `tickStatuses`. Rupture captures and clears them again in `detonateBleed`

Risk is high: turn timing and saved state must remain coherent. Keep partial reduction, full removal, decay, detonation and rewarded Cleanse distinct while centralizing bookkeeping.

### Proposed design

1. Inventory every writer of control fields, harmful stacks, attribution and Bleed payouts. Record each operation's payout and reward semantics before replacing it
2. Route status application, turn start and Cleanse through named transitions for entering control, consuming a controlled turn, recovery and Cleansing control
3. Add explicit operations for attributed stack grants, reduction, clearing and Bleed payout capture; avoid a Boolean-configured `updateStatus`
4. State helpers atomically update quantities/attribution and return removal/payout facts. Generators retain event and Cleanse-reward insertion points
5. Share ordered Bleed allocation between ticking and Rupture where equivalent; retain each caller's capture timing and source-side eligibility, tracing recipient scope first
6. Infer the public combat type from its exported structural schema, following `GameState`, if dependency direction permits; retain deliberately narrower view interfaces
7. Initially preserve saved layout. After centralizing writes, optionally replace `controlled`/`controlTurns` with nullable active control in a separate commit. Keep `skipped` independent: the final skipped turn can coexist with new cooldown. Group fields only to remove contradictions

Any optional shape change follows the shared save safeguard, retaining source identity, Bleed payout bounds and control-coherence validation even with stronger types.

### Acceptance

- Runtime control transitions have one owner; clients cannot silently leave a duration behind when clearing control
- Stack reduction and removal cannot leave stale source attribution or over-allocated Bleed payouts
- Clean Getaway retains its partial-reduction semantics and does not gain ordinary Cleanse rewards through helper reuse
- Earned Bleed healing survives a threshold Cleanse, while unearned future obligations disappear when appropriate
- Controlled reserves, the final skipped turn, shared immunity, multiple control applications and current-format save/resume remain covered
- Ordinary status handlers do not know the representation of deferred payout allocation

Reduce invalid combinations through these transitions, not extensible effect objects or generic duration scheduling.

## 3. Separate targeting rules from battle interaction and layout

### Evidence

[Engine play admission](../src/game/engine.ts), [ability execution](../src/game/combat/abilities.ts) and [BattleScreen](../src/ui/battle/battle-screen.tsx) each interpret effect/target combinations. The screen repeats the chosen-target predicate again inside its card click handler. Adding a target mode therefore requires coordinated edits across rules and presentation.

The 474-line screen also owns selected and hovered cards/targets, remembered recipients, denial timers, controller navigation, post-command focus, pointer cancellation, authoritative preview execution, status comparisons, target-line geometry and JSX. [TargetPreview](../src/ui/battle/target-preview.tsx) repeats before/after lookup and status comparison work. `JSON.stringify` of rendered status records is used to decide which units need previews.

Risk is medium: preserve input and rendered behavior. [Targeting tests](../tests/unit/ui/targeting.test.tsx) protect the player-facing distinctions; changing those rules should not require understanding SVG measurement or focus restoration.

### Proposed design

1. Query target requirements/legal recipients from canonical battlefield, Health and effect rules without RNG. Distinguish chosen enemy, chosen ally and automatic targeting, plus missing versus explicitly invalid targets, including self-targets
2. Share the query across engine admission, UI selection/highlights and Auto-play candidates; dispatch remains authoritative and revalidates. Do not persist recipients or treat them as permission tokens
3. Let execution reuse the underlying target classification where it helps, while preserving timing differences. Random recipients are selected once for an ability including repeats; group recipients are reread at their existing execution boundaries; interception occurs at delivery. The read-only query must never roll, choose an enemy action or freeze future recipients
4. Extract an interaction reducer for selection, hover, side-specific recipient memory, cancellation and accepted-command cleanup. Derive legal/active targets; keep DOM references and focus in a thin hook adapter
5. Give target-line measurement one layout hook, preserving coordinates, update timing, observer cleanup, composition and animation
6. Share one immutable preview model between highlights and `TargetPreview`: affected IDs, Health/Block/status changes and grouped events. Remove duplicate scans and status-string comparisons
7. Retain hand/feedback owners unless integration requires a change; do not span unrelated screens with an interaction framework

### Acceptance

- Adding or changing a chosen-target mode has one gameplay rule owner
- Pointer selection waits for hover; leaving the target clears its preview; controller navigation remembers the correct side; a sole recipient still requires activation
- Automatic cards play directly, including replacing an existing chosen-target selection
- Cancellation restores the appropriate card focus; accepted plays restore hand position; rejected plays do not mutate gameplay or RNG
- Ally summons, enemy summons, Legendary ordering, dead targets and a selected card leaving the hand behave consistently
- Preview execution still uses the authoritative resolver and never publishes, saves, spends resources or advances live RNG
- Before/after rendered captures match for normal and enlarged text, minimum and desktop viewports, mouse and keyboard/controller simulation, and reduced motion

This stage requires rendered/input evidence under [required review](UI.md#required-review); DOM tests cannot establish geometry, composition or visible focus.

## 4. Stop Auto-play from maintaining parallel combat arithmetic

### Evidence

[rankedBattleChoices](../src/application/battle-policy.ts) combines replacement selection, card admissibility, attack arithmetic, healing/overflow arithmetic, utility detection, score assignment and command construction. The large effect-specific chain ends in a default guard-style scoring branch, so an added effect can acquire unrelated scoring behavior without an exhaustive policy decision.

The attack `progress` helper independently calculates modified value, Armor, Block, Freeze nullification and lethal eligibility. Healing independently applies Mending, overflow and Clean Slate conditions. These calculations overlap [damage](../src/game/combat/damage.ts) and [protection](../src/game/combat/protection.ts), while classification of follow-up utility repeats knowledge about authored extras.

Risk is medium to high: policy changes alter balance-tool decisions. Retain approximate evaluation of visible facts, separating intentional omissions from mechanical drift.

### Proposed design

1. Separate legal candidate enumeration, visible benefits and ranking; enumeration uses stage 3 admission/targeting queries and emits unscored play/replacement choices
2. Share only suitable pure arithmetic extracted in stage 1 and the corresponding healing calculation. These helpers cannot inspect draw order, advance RNG, consume one-use permissions or execute child reactions. Accept explicit ordinary-hit assumptions and document what the caller omits
3. Label unshared mechanics as approximations. Distinguish guaranteed from branch-dependent lethal outcomes; averaged damage/scores cannot establish a guaranteed finish
4. Exhaustively classify each effect into visible Health damage, removed defense, useful healing, status and resource utility; remove the guard-style fallback
5. Keep scoring weights, reasons and stable tie breaks in one application policy owner. Name the current numeric priority bands first. Consider a lexicographic ranking only after captured representative orderings prove it equivalent; do not silently rebalance policy during structural extraction
6. Preserve [the battle actor](../src/application/battle-actor.ts) as the owner of cycle history. Its visible-state signature and repeated-action guard solve a demonstrated draw/recovery cycle; removing them or replacing them with a fixed actions-per-turn cap would regress productive Memento turns
7. Keep [UI pacing](../src/ui/battle/autoplay.ts) and [headless decisions](../src/tooling/journey-policy.ts) as consumers of the single policy

Do not substitute per-candidate `previewPlay`: detached execution can read hidden saved RNG/deck order and change information access and cost. Stochastic search is outside scope.

### Acceptance

- Shared arithmetic has runtime and policy consumers without importing application code into gameplay
- Candidate admission matches dispatch for the same revision and explicit Auto-end turn preference
- Scoring/choosing are pure and deterministic
- Changing hidden RNG or hidden deck order alone does not change visible-state rankings
- Fixed representative rankings retain healing priority, ordinary battle-finishing priority, Purge before fully blocked attacks, useful Block depletion, complementary replacements, mixed healing/protection and summon utility
- Existing recorded draw/recovery cycles still terminate across ordinary save/resume; productive long turns retain their plays

## Supporting improvement: make combatant identity and mutation explicit

[Combatant](../src/game/combat/state.ts) is `Creature | Enemy`, but [Enemy](../src/game/types.ts) also represents player-owned Echoes. The canonical [isEnemy](../src/game/battlefield.ts) therefore combines object shape with summon side. Some consumers still infer allegiance directly from `"maxHealth" in actor`; other property tests legitimately select a custom maximum Health. Those are different questions and should have different names.

Also, `combat(unit)` sounds like a read accessor but initializes state when absent. Initialization is useful inside drafts, while read-only policy/presentation must avoid it. This makes the query/mutation boundary harder to see in code review.

Risk is medium when bounded, high if expanded into a state rewrite. During the preceding stages:

1. Use named allegiance, roster/summon and maximum-Health queries rather than treating one property test as all three answers
2. Distinguish read access from initialization; initialize combat state at battle creation and admitted transitions. Give any remaining lazy initializer a mutation-signaling name
3. Expose shared combatant fields through a narrow read-only view where that avoids unnecessary enemy/creature branching. Preserve stable individual IDs, ordered arrays and source-attribution records
4. Add an explicit persisted combatant discriminant only if narrow queries prove insufficient. That would require a separately reviewed save-format change and complete consumer/fixture updates

Retain existing arrays and object ownership; add no duplicate roster, live-state graph or class hierarchy. Property tests show coupling, not proven reachable misclassification.

## Delivery sequence

Use sequential review slices in one task worktree. Slice counts are planning estimates, not time estimates; reaction semantics may change them. Every stage also meets its section's acceptance list and the [shared safeguards](#shared-safeguards).

| Stage (review slices) | Depends on  | Work and exit evidence                                                                                                                                                                                                      |
| --------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A (1)                 | —           | Capture ownership, existing regressions, [combat traces](../tests/unit/game/combat-resolution.test.ts), [fixed-input journey traces](../tests/unit/game/journey-lifecycle.test.ts) and policy rankings before runtime edits |
| B (3–5)               | A           | Extract damage arithmetic and ordered coordinator; complete command/event/RNG parity, including save/resume                                                                                                                 |
| C (2–4)               | A, stable B | Centralize status/control transitions and payouts; control/deferred-payout and save/resume parity, with only explicit representation/version normalization                                                                  |
| D (1–2)               | A           | Share targeting queries; admission/recipient equivalence without presentation changes                                                                                                                                       |
| E (2–3)               | D           | Separate interaction/preview presentation; record baseline inputs before runtime edits, compare matching after captures (seed/commands/viewport/text/motion), and run targeting/input/motion tests and browser flows        |
| F (2–3)               | B, D        | Separate Auto-play candidates, benefits and ranking; information-boundary/cycle regressions and fixed-state rankings kept separate from seeded journeys, without rewriting gameplay's fixed command inputs                  |
| G (1)                 | B–F         | Review the combined diff and pass protected integration and required rendered review on current main plus the task; use changed-file checks and meaningful named suites during development                                  |

Small identity/read-access changes accompany their consumer stage. Any optional persisted control-shape change is a separate slice after C; omit it if helpers remove the risk. B and C must not change the same reaction semantics in one commit.

Extend existing [reaction](../tests/unit/game/combat-reactions.test.ts), [combat regression](../tests/unit/game/combat-bug-regressions.test.ts), [policy](../tests/unit/application/battle-policy.test.ts), [actor](../tests/unit/application/battle-actor.test.ts), [save](../tests/unit/game/save-boundaries.test.ts) and [targeting](../tests/unit/ui/targeting.test.tsx) suites only for missing boundaries. Avoid implementation-shaped helper tests and parallel test hierarchies.

Report broad static, full unit/exhaustive, build, browser/replay and Windows packaging/startup results for the exact CI commit when available. Local completion, CI, physical controllers, Steam client and Steam Deck are separate outcomes.

## Areas to retain

The following inspected complexity serves concrete reliability or ownership needs and is not a priority for removal:

- The combat scheduler and typed packet policy: small mechanisms that make depth-first reactions and termination rules explicit
- The lifecycle union and phase admission table: useful constraints already replacing invalid nullable combinations
- The session's serialized save admission before publication, failed-write handling and shutdown drain: reentrancy and durability contracts require these distinctions
- Cloud snapshot validation, reconciliation policy and transport lifetime: recently separated owners protect offline durability and conflict preservation
- Navigation reducer/focus ownership and Auto-play cancellation guards: nested surfaces and queued callbacks have real lifetime differences
- Semantic save validation: type correctness does not establish identity, ownership, zone uniqueness or payout validity
- Authored content modules, six compiler environments, architecture checks, worktree isolation and protected integration: their existence is not evidence of unnecessary abstraction

Broad file splitting, dependency replacement, an event bus, combat DSL or state-library migration is outside this proposal.

## Assessment evidence and limits

This assessment used source inspection of gameplay, application, UI, platform/tooling boundaries, existing tests, current architecture guidance and previous implementation records. The source observations above are tied to the baseline commit, not to uncommitted runtime experiments. No new gameplay defect, speedup, build readiness or visual parity is asserted. Documentation checks and integration of this plan do not validate the proposed runtime changes; those require the staged evidence above.
