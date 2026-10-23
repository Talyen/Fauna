# Further codebase simplification

Assessment date: October 23, 2026. Source baseline: `f0d462e9bddb74d15668a132ca253ac64620447c` on local main. This is a proposed implementation plan; this assessment changes documentation only.

The most expensive remaining complexity is concentrated in combat rules and battle interaction. The problem is how many facts and ordering rules a maintainer must hold in their head to make one safe change. File length alone is not the criterion, and additional frameworks would make these areas worse.

The recent [simplification work](SIMPLIFICATION_PLAN.md) already removed competing journey routes, persisted roster/lineup mirrors, unreachable Collection reveals and distributed navigation ownership. The lifecycle union, shared ability executor and explicit combat stack also already exist. Keep those improvements; this plan addresses the remaining complexity inside and between their owners.

## Priorities

| Priority   | Area                                   | Concrete cost today                                                                                                                          | Intended result                                                                  | Refactor risk                                                 |
| ---------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1          | Damage calculation and reactions       | One `resolveHit` spans lines 148–585 and interleaves calculation, payment, child reactions and presentation facts                            | A readable ordered coordinator with small calculation and reaction owners        | High: RNG, rounding and reaction order are observable         |
| 2          | Status lifecycle and bookkeeping       | Control, status attribution and deferred Leech require coordinated writes across several modules                                             | Named atomic transitions with one owner for each bookkeeping invariant           | High: turn timing and saved state must remain coherent        |
| 3          | Targeting rules and battle interaction | Engine admission, ability execution and UI repeat targeting interpretations; the screen also owns input, focus, preview diffing and geometry | Shared read-only targeting rules plus a small battle interaction owner           | Medium: preserve input and rendered behavior                  |
| 4          | Auto-play evaluation                   | A second set of damage/healing formulas sits beside a long scoring chain and numeric priorities                                              | Separate legal candidates, shared visible arithmetic and explicit scoring policy | Medium to high: policy changes alter balance-tool decisions   |
| Supporting | Combatant identity and read access     | Player summons use the `Enemy` shape; property tests and mutable accessors obscure intent                                                    | Named side/role queries and distinct read versus initialize operations           | Medium if kept bounded; high if expanded into a state rewrite |

The first two are the serious structural problems. The third and fourth are worthwhile follow-on simplifications. The supporting change should be incremental work within those stages, not a separate creature-system rewrite. Confidence is high in the observed duplication and mixed responsibilities; the expected maintenance benefit is an engineering judgment, not a measured performance claim or a newly reproduced bug.

## 1. Make damage resolution readable in execution order

### Evidence

[Damage resolution](../src/game/combat/damage.ts) already uses the typed generator stack correctly, but its largest handler still owns nearly every rule involved in a hit:

- Admission, Blind/Dodge and Dodge talents at the beginning of `resolveHit`
- Offensive modifiers, target modifiers, deployed resistance auras and rounding
- Critical state consumption, Block payment, Armor erosion and Health loss
- Threshold reactions before Block/damage event publication
- Gold, healing, Boons, Water follow-ups, harmful buildup and attack procs
- Thorns, Leech, control rewards, creature retaliation and deferred Armor-break delivery

Several names conceal different quantities. `damage` successively means modified attack value, post-Critical value and post-mitigation value; `lost` is actual Health removed. `blocked` differs from `blockSpent` under Reinforce. Armor depletion receipts are collected at several points and delivered later. These distinctions are real gameplay rules, but the current local-variable lifetime makes them difficult to audit.

The existing [reaction regressions](../tests/unit/game/combat-reactions.test.ts) demonstrate why this matters: Sun-Struck Shield uses Block spent rather than amplified absorption; Last Resort can remove a wound without revoking Leech already earned; an earlier child reaction can knock out the actor before later work begins.

### Proposed design

Keep [packet policy](../src/game/combat/policy.ts), [typed operations](../src/game/combat/operations.ts), [the depth-first scheduler](../src/game/combat/resolution.ts) and one synchronous command transaction. Simplify the handler behind that boundary.

1. Write the current stage sequence beside the coordinator as direct function calls and generator delegations. Extract only meaningful rule groups: Dodge response, offensive arithmetic, incoming mitigation, defense/Health payment, attack procs and retaliation. Use ordinary named functions; do not introduce stage registration, runtime sorting, plugins or a generic rule language
2. Separate pure arithmetic from mutations. A damage calculation takes the current combatants, packet eligibility and explicit attack facts; it returns numeric facts without rolling RNG, consuming flags, changing state or emitting events. Keep rounding and addition/multiplication order identical to the original expression sequence
3. Name the captured payment facts: Health before payment, Health lost, damage absorbed, Block spent, Critical result and pending Armor depletions. These are transient values passed directly to the stages that need them, not a second persisted combat model
4. Keep live queries live. After every yielded child, re-read Health, status, deployment and continuation eligibility wherever the current code does. Never cache a broad snapshot of all talents, auras or combatants across reactions merely to shorten arguments
5. Turn the long attack-proc section into small explicit families while retaining its source order. The family helper checks actor liveness before each later roll. A table is suitable only for genuinely identical leaf rules; branches with different timing or payout semantics stay explicit
6. Keep the outer `hit` owner's Wrong Foot, Resonance and bounce sequence visible and separate. Preserve `ignored`, `miss` and `landed` with zero Health loss as distinct results
7. Delete the extracted inline implementations as each group moves. A pass-through helper that merely relocates a hundred lines without clarifying its inputs or timing does not complete this step

Avoid a giant mutable “hit context” passed everywhere. Use a small shared invocation record only if it reduces repeated arguments; use narrow immutable result records at calculation/payment boundaries. Helpers should receive the facts they consume.

### Acceptance

- A reviewer can read `resolveHit` and identify the complete stage order without traversing talent implementations
- Only the arithmetic owner defines ordinary outgoing/incoming damage formulas; callers do not reproduce mitigation
- Full command traces preserve accepted/rejected results, ordered event payloads, RNG and final state
- Threshold Cleanse, Block replenishment during reactions, Armor regrant/rebreak, fully absorbed Critical hits, reflected control, attacker knockout, Death's Door, bounce and Resonance retain their current behavior
- No saved continuations, asynchronous combat, event-triggered gameplay or new dependencies

Risk is primarily accidental movement of a calculation across a child reaction. Keep extraction commits small and compare the deterministic traces after every family. Do not update golden results to make an unexplained difference disappear.

## 2. Give status transitions one bookkeeping owner

### Evidence

[CombatState](../src/game/types.ts) mixes status magnitudes, attribution, deferred payouts, control phase, one-use permissions and per-turn counters in one flat structure. Its shape is also separately declared in [the save schema](../src/game/state-schema.ts) and initialized in [freshCombat](../src/game/combat/state.ts).

The strongest problem is coordinated mutation rather than the number of fields:

- Active control uses `controlled`, `controlTurns`, `cooldown` and `skipped`. Application lives in [statuses](../src/game/combat/statuses.ts); expiration lives in [startAction](../src/game/combat/lifecycle.ts); Cleanse has a third multi-field transition; [save validation](../src/game/save.ts) reconstructs their coherence
- Burn, Poison and Bleed amounts have parallel `statusSources`; Bleed also has ordered `bleedLeech` obligations
- Clean Getaway directly reduces stacks and trims Bleed payouts in [damage](../src/game/combat/damage.ts). Ordinary Cleanse clears them in `removeEffects`. Ticking captures payouts and decays stacks in `tickStatuses`. Rupture captures and clears them again in `detonateBleed`

These paths have deliberately different rules. Consolidation must centralize mechanical bookkeeping without making partial reduction, full removal, natural decay, detonation and rewarded Cleanse synonymous.

### Proposed design

1. Inventory every writer of control fields, harmful stacks, attribution and Bleed payouts. Record each operation's payout and reward semantics before replacing it
2. Introduce small named state transitions for entering control, consuming a controlled turn, recovering from control and Cleansing control. Have status application, start-of-turn processing and Cleanse call those transitions rather than assign correlated fields themselves
3. Centralize harmful-stack bookkeeping in narrow operations for adding attributed stacks, reducing stacks, clearing a status and capturing a Bleed payout. Keep explicit operations rather than a generic `updateStatus` function with a collection of Boolean flags
4. Separate atomic bookkeeping from yielded rewards. State helpers update quantities/attribution and return the removal or payout facts; existing generator handlers emit the appropriate events and schedule Cleanse rewards at their current insertion points
5. Share the ordered Bleed payout allocation calculation between tick and Rupture where semantics match. The caller still decides when obligations are captured and which side's sources are eligible. Do not assume identical recipient scope without tracing both paths
6. Export the combat structural schema and infer the public combat type from it, following the existing `GameState` pattern, if this introduces no runtime dependency cycle. Preserve useful view interfaces only where they express a deliberately narrower boundary
7. First keep the saved field layout unchanged. After write ownership is centralized, consider replacing `controlled` plus `controlTurns` with a nullable active-control record in a separate commit. Keep “skipped this turn” independent from active control: the final skipped turn can coexist with newly started cooldown. Group fields only when it removes representable contradictions, not for cosmetic nesting

If the last step changes persisted shape, bump the development save version and update current-format fixtures. Reject obsolete saves; do not build migration infrastructure. Preserve semantic checks for source identities, total Bleed payout bounds and control coherence even if the type becomes stronger.

### Acceptance

- Runtime control transitions have one owner; clients cannot silently leave a duration behind when clearing control
- Stack reduction and removal cannot leave stale source attribution or over-allocated Bleed payouts
- Clean Getaway retains its partial-reduction semantics and does not gain ordinary Cleanse rewards through helper reuse
- Earned Bleed healing survives a threshold Cleanse, while unearned future obligations disappear when appropriate
- Controlled reserves, the final skipped turn, shared immunity, multiple control applications and current-format save/resume remain covered
- Ordinary status handlers do not know the representation of deferred payout allocation

This is the place to reduce invalid combinations. Replacing the entire status system with entities, components, extensible effect objects or generic duration scheduling would increase the abstraction burden.

## 3. Separate targeting rules from battle interaction and layout

### Evidence

[Engine play admission](../src/game/engine.ts), [ability execution](../src/game/combat/abilities.ts) and [BattleScreen](../src/ui/battle/battle-screen.tsx) each interpret effect/target combinations. The screen repeats the chosen-target predicate again inside its card click handler. Adding a target mode therefore requires coordinated edits across rules and presentation.

The 474-line screen also owns selected and hovered cards/targets, remembered recipients, denial timers, controller navigation, post-command focus, pointer cancellation, authoritative preview execution, status comparisons, target-line geometry and JSX. [TargetPreview](../src/ui/battle/target-preview.tsx) repeats before/after lookup and status comparison work. `JSON.stringify` of rendered status records is used to decide which units need previews.

This is unnecessary coupling: a targeting-rule change should not require understanding SVG measurement or hand focus restoration. The existing [targeting suite](../tests/unit/ui/targeting.test.tsx) already describes the player-facing distinctions the refactor must preserve.

### Proposed design

1. Add a read-only gameplay query for target requirements and legal explicit recipients. Its result distinguishes chosen enemy, chosen ally and automatic targeting. Distinguish no target supplied from an explicitly invalid target, including self-target validation. The query uses the canonical battlefield, Health and effect rules and consumes no RNG
2. Use it for engine admission, UI selection/highlights and Auto-play candidate enumeration. The engine remains authoritative and validates again at dispatch. Legal recipients are data, not a saved cache or permission token
3. Let execution reuse the underlying target classification where it helps, while preserving timing differences. Random recipients are selected once for an ability including repeats; group recipients are reread at their existing execution boundaries; interception occurs at delivery. The read-only query must never roll, choose an enemy action or freeze future recipients
4. Extract a battle interaction hook with a small reducer for selection, hover, remembered side-specific recipients, cancellation and successful-command cleanup. Derive legal/active targets from current game state instead of storing another target list. Keep browser references and focus work in a thin hook adapter
5. Extract target-line measurement into one layout hook. Preserve its coordinates, update timing and observer cleanup. This step changes ownership, not artwork composition or animation
6. Build one immutable preview presentation model per authoritative preview. It contains affected IDs, per-unit Health/Block/status changes and grouped event facts. Both highlights and `TargetPreview` consume it, removing repeated battlefield scans and string comparison of rendered status arrays
7. Leave hand animation and feedback owners intact unless a concrete integration need appears. Avoid a general interaction framework or an abstraction spanning unrelated screens

### Acceptance

- Adding or changing a chosen-target mode has one gameplay rule owner
- Pointer selection waits for hover; leaving the target clears its preview; controller navigation remembers the correct side; a sole recipient still requires activation
- Automatic cards play directly, including replacing an existing chosen-target selection
- Cancellation restores the appropriate card focus; accepted plays restore hand position; rejected plays do not mutate gameplay or RNG
- Ally summons, enemy summons, Legendary ordering, dead targets and a selected card leaving the hand behave consistently
- Preview execution still uses the authoritative resolver and never publishes, saves, spends resources or advances live RNG
- Before/after rendered captures match for normal and enlarged text, minimum and desktop viewports, mouse and keyboard/controller simulation, and reduced motion

Rendered interaction evidence is required for this stage. DOM tests alone do not establish geometry, composition or focus visibility. Physical-controller verification remains a separate boundary.

## 4. Stop Auto-play from maintaining parallel combat arithmetic

### Evidence

[rankedBattleChoices](../src/application/battle-policy.ts) combines replacement selection, card admissibility, attack arithmetic, healing/overflow arithmetic, utility detection, score assignment and command construction. The large effect-specific chain ends in a default guard-style scoring branch, so an added effect can acquire unrelated scoring behavior without an exhaustive policy decision.

The attack `progress` helper independently calculates modified value, Armor, Block, Freeze nullification and lethal eligibility. Healing independently applies Mending, overflow and Clean Slate conditions. These calculations overlap [damage](../src/game/combat/damage.ts) and [protection](../src/game/combat/protection.ts), while classification of follow-up utility repeats knowledge about authored extras.

The policy explicitly promises an approximation using visible facts, not a complete forecast. That is a useful boundary and should stay. The problem is that approximation policy and duplicated mechanics are interleaved, making it hard to tell an intentional omission from rule drift.

### Proposed design

1. Separate candidate enumeration, visible benefit assessment and ranking. Candidate enumeration uses the shared admission/targeting queries from stage 3 and emits legal play/replacement options without scores
2. Share only suitable pure arithmetic extracted in stage 1 and the corresponding healing calculation. These helpers cannot inspect draw order, advance RNG, consume one-use permissions or execute child reactions. Accept explicit ordinary-hit assumptions and document what the caller omits
3. For mechanics not shared safely, expose the approximation in the benefit model instead of pretending it is an exact result. Keep guaranteed versus branch-dependent lethal conclusions distinct; averaging damage or scores must not imply a guaranteed finish
4. Have an exhaustive effect switch produce visible facts such as ordinary Health damage, defense removed, useful healing, status utility and resource utility. Each authored effect gets an explicit handling decision; replace the catch-all guard-style fallback
5. Keep scoring weights, reasons and stable tie breaks in one application policy owner. Name the current numeric priority bands first. Consider a lexicographic ranking only after captured representative orderings prove it equivalent; do not silently rebalance policy during structural extraction
6. Preserve [the battle actor](../src/application/battle-actor.ts) as the owner of cycle history. Its visible-state signature and repeated-action guard solve a demonstrated draw/recovery cycle; removing them or replacing them with a fixed actions-per-turn cap would regress productive Memento turns
7. Keep [UI pacing/cancellation](../src/ui/battle/autoplay.ts) and [headless journey decisions](../src/tooling/journey-policy.ts) as consumers. Do not duplicate policy into either runner

Do not call the exact `previewPlay` once per candidate as a shortcut. Detached execution can still read hidden saved RNG/draw order, and exhaustive simulation changes the policy's information boundary and cost. A new stochastic search system is outside this simplification.

### Acceptance

- Shared arithmetic has runtime and policy consumers without importing application code into gameplay
- Candidate admission matches dispatch for the same revision and explicit Auto-end turn preference
- Scoring and choosing are deterministic, mutate no game state and consume no gameplay RNG
- Changing hidden RNG or hidden deck order alone does not change visible-state rankings
- Fixed representative rankings retain healing priority, ordinary battle-finishing priority, Purge before fully blocked attacks, useful Block depletion, complementary replacements, mixed healing/protection and summon utility
- Existing recorded draw/recovery cycles still terminate across ordinary save/resume; productive long turns retain their plays
- Any intentional ranking change is separately identified, versioned and assessed with paired balance runs; unexplained differences are not accepted as refactor noise

## Supporting improvement: make combatant identity and mutation explicit

[Combatant](../src/game/combat/state.ts) is `Creature | Enemy`, but [Enemy](../src/game/types.ts) also represents player-owned Echoes. The canonical [isEnemy](../src/game/battlefield.ts) therefore combines object shape with summon side. Some consumers still infer allegiance directly from `"maxHealth" in actor`; other property tests legitimately select a custom maximum Health. Those are different questions and should have different names.

Also, `combat(unit)` sounds like a read accessor but initializes state when absent. Initialization is useful inside drafts, while read-only policy/presentation must avoid it. This makes the query/mutation boundary harder to see in code review.

During the preceding stages:

1. Use named allegiance, roster/summon and maximum-Health queries rather than treating one property test as all three answers
2. Distinguish read access from initialization; initialize combat state at battle creation and admitted transitions. Give any remaining lazy initializer a mutation-signaling name
3. Expose shared combatant fields through a narrow read-only view where that avoids unnecessary enemy/creature branching. Preserve stable individual IDs, ordered arrays and source-attribution records
4. Add an explicit persisted combatant discriminant only if narrow queries prove insufficient. That would require a separately reviewed save-format change and complete consumer/fixture updates

Do not introduce a universal entity registry, duplicate roster, separate live-state object graph or runtime class hierarchy. The immediate objective is clear intent at existing boundaries. Existing property checks are evidence of representation coupling, not proof that every affected caller currently misclassifies a reachable actor.

## Delivery sequence

Keep these as sequential, independently reviewable changes in one task worktree. The units below are implementation/review slices, not time estimates; reaction semantics can change the required effort substantially.

| Stage | Work                                                     | Expected review slices | Dependency and exit gate                                                                                            |
| ----- | -------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| A     | Capture baseline and ownership inventory                 | 1                      | Current deterministic traces, existing regressions and representative policy rankings recorded before runtime edits |
| B     | Damage calculation and ordered coordinator               | 3–5                    | A; complete command/event/RNG parity before proceeding                                                              |
| C     | Atomic status/control transitions and payout bookkeeping | 2–4                    | A and stable B; save/resume and control/deferred-payout parity                                                      |
| D     | Shared targeting queries                                 | 1–2                    | A; admission/recipient equivalence, no presentation change yet                                                      |
| E     | Battle interaction and preview presentation model        | 2–3                    | D; rendered/input evidence and event/preview parity                                                                 |
| F     | Auto-play candidate/benefit/ranking separation           | 2–3                    | B and D; ranking, information-boundary and cycle regressions                                                        |
| G     | Final combined review and protected integration          | 1                      | Required verification and rendered evidence pass on current main combined with the task                             |

Small identity/read-access changes accompany the stage that needs them. The optional persisted control-shape change is its own review slice after C; omit it if helper ownership already removes the substantive risk. B and C should not both change the same reaction semantics in one commit.

### Baseline and verification details

1. Preserve the existing [combat traces](../tests/unit/game/combat-resolution.test.ts) and [fixed-input journey traces](../tests/unit/game/journey-lifecycle.test.ts). If a current trace fails before edits, investigate and record that baseline separately rather than recapturing it as part of this refactor
2. Extend the owning [reaction](../tests/unit/game/combat-reactions.test.ts), [combat regression](../tests/unit/game/combat-bug-regressions.test.ts), [policy](../tests/unit/application/battle-policy.test.ts), [actor](../tests/unit/application/battle-actor.test.ts), [save](../tests/unit/game/save-boundaries.test.ts) and targeting suites only where a named boundary lacks coverage. Avoid implementation-shaped helper tests or a second test hierarchy
3. For B/C, compare full accepted command results and state after save/resume, preserving ordered event payloads and RNG. If persisted representation changes, normalize only the explicitly changed field representation/version in the behavior comparison, while testing current-format decoding separately
4. For D/E, run focused targeting, input and motion tests, then browser targeting/control flows with isolated profiles. Capture the baseline before modifying runtime code; compare the same seed, command sequence, viewport, text size and motion setting
5. For F, keep fixed-state ranking checks separate from seeded journey behavior. Later policy changes must never rewrite the fixed command inputs used to validate the gameplay refactor
6. Follow [Contributing](../CONTRIBUTING.md#verification): use changed-file verification and meaningful named suites while working; run the protected combined integration gate after commits. Preserve the existing resource limits, shared lock, dirty-main protection and task evidence
7. Broad static, full unit/exhaustive, production build, browser/replay and Windows packaging/startup evidence should be reported for the exact CI commit when available. Local completion and hosted CI completion are different claims; physical controllers, Steam client and Steam Deck remain explicit separate gates

### Stop conditions

- Stop an extraction when its captured-value versus live-value semantics cannot be explained or a deterministic trace diverges without an understood cause
- Split a demonstrated gameplay correction into a separate fix with its own regression and before/after explanation; do not hide behavior changes inside simplification
- Reject abstractions whose only benefit is shorter files while requiring more navigation or configuration to understand one effect
- Finish each stage by removing the superseded implementation. Do not retain dual rule paths, compatibility shims or a permanently partial conversion
- Do not claim a performance gain or rendering parity from code inspection alone

## Areas to retain

The following inspected complexity serves concrete reliability or ownership needs and is not a priority for removal:

- The combat scheduler and typed packet policy: small mechanisms that make depth-first reactions and termination rules explicit
- The lifecycle union and phase admission table: useful constraints already replacing invalid nullable combinations
- The session's serialized save admission before publication, failed-write handling and shutdown drain: reentrancy and durability contracts require these distinctions
- Cloud snapshot validation, reconciliation policy and transport lifetime: recently separated owners protect offline durability and conflict preservation
- Navigation reducer/focus ownership and Auto-play cancellation guards: nested surfaces and queued callbacks have real lifetime differences
- Semantic save validation: type correctness does not establish identity, ownership, zone uniqueness or payout validity
- Authored content modules, six compiler environments, architecture checks, worktree isolation and protected integration: their existence is not evidence of unnecessary abstraction

Do not start with broad file splitting, dependency replacement, a generic event bus, a combat DSL, a state-library migration or a rewritten test runner. The intended gain is fewer independent rule interpretations and fewer places where callers must synchronize correlated facts.

## Assessment evidence and limits

This assessment used source inspection of gameplay, application, UI, platform/tooling boundaries, existing tests, current architecture guidance and previous implementation records. The source observations above are tied to the baseline commit, not to uncommitted runtime experiments. No new gameplay defect, speedup, build readiness or visual parity is asserted. Documentation checks and integration of this plan do not validate the proposed runtime changes; those require the staged evidence above.
