# Ability rule contracts — October 23, 2026

## Scope and result

Task branch: `task/ability-rule-contracts`, starting from committed local main `3ee3e5978574a9378e98cbca65c0772433c015eb`.

The implementation completes the six-stage architecture plan: pre-extraction behavior baselines, complete typed ability policies, separate mutation handlers, migration of every primary and supplemental kind, shared gameplay facts for Auto-play, and enforced/documented ownership. Current rules live in [Architecture](../ARCHITECTURE.md#ability-rules) and [Content](../CONTENT.md#adding-ability-mechanics).

All 29 primary kinds declare targeting, scaling, enemy support/adaptation, progression keywords and descriptions. All 12 supplemental kinds declare scaling, enemy support, keyword classification, delivery, description and ordinary-attack utility. Execution maps require handlers for every kind; supplemental reflection explicitly returns an extra or retains it with its actor. Pure policies cannot import content/runtime implementation, and presentation cannot import the new execution modules.

The existing executor retains random target selection, repeat rolls, pre-play reactions, attack setup and event ordering. Live recipients still resolve inside handlers through the existing synchronous combat scheduler. Authored cards and saves remain plain data; this task introduces no save-format change, balance change, new dependency, passive/talent redesign or UI change.

## Integration review

Behavior baselines were committed first as `1294dcf`; the main implementation is `daa3b37`. Reviewed main merges preserve newer card-zone placement, progression validation, navigation/preferences and Auto-play fixes. The overlapping useful-draw fix remains intact in the shared gameplay query: keyword filtering, buffered cards, consumed-card exclusions and Well Read behavior are retained. Current application ranking weights and priorities remain application-owned.

Recovered cards now reuse the canonical `receiveCard` owner. The final diff was reviewed against current main, with unrelated main changes retained.

## Evidence and boundaries

- Before extraction, `npm test -- tests/unit/game/ability-contracts.test.ts` passed all nine tests in 466 ms and recorded nine snapshots. Coverage includes every authored card's text/scaling/targeting/keywords/enemy adaptation and eight representative command, preview, state/event, RNG, save/resume and ranking scenarios. The oracles were not regenerated after implementation
- The allowed focused test run was used for that baseline; post-refactor execution of this suite, the existing combat/policy regressions and compilation are deferred to CI under the Mac resource policy
- Lightweight formatting, syntax lint, source-boundary and documentation checks passed after main reconciliation. The protected integration gate reruns its required checks; its outcome is reported in the task handoff
- A source-body comparison against the baseline found unchanged bodies for 40 of 41 extracted primary/supplemental handlers after removing wrapper destructuring and source locations. The attack handler was separately reviewed: its reflected extras move to the complete supplemental registry and its final recipient returns through the execution context. This is source review, not runtime parity proof
- An isolated Vite browser capture at 1280×720, 125% text and reduced motion rendered Autumn Insight targeting with its existing recovery/recipient-healing copy and +3 Health forecast. The whole frame was inspected; layout checks reported no violations or browser errors. Local image: `reports/ability-rule-contracts/targeting-initial.png`
- Initial review scripts stopped because they attempted full inspection from battle/pile cards, where the existing UI deliberately provides tooltips. Their failed records remain in `reports/ability-rule-contracts/evidence-initial.json` and `reports/ability-rule-contracts/evidence-pile-attempt.json`. They do not establish completed inspection/commit coverage
- The corrected Collection inspection/cancellation/invalid-target/commit review could not start: bounded host-lane admission returned busy. Its script is retained at `reports/ability-rule-contracts/review.mjs`. No foreign process or reservation was changed. The [UI review procedure](../UI.md#required-review) exempts behavior-preserving source changes with no visual/interaction effect from required rendered evidence; this optional follow-up remains explicitly deferred

Full CI, post-refactor runtime parity, build, browser suites and Windows packaging remain pending. Native desktop, physical controllers, Steam client and Steam Deck were not exercised. No push or PR was requested or performed.
