# Combat and battle interaction simplification

The [approved plan](../archive/COMPLEXITY_REDUCTION_PLAN.md) was implemented in the retained `task/complexity-plan-oct23` worktree. [Architecture](../ARCHITECTURE.md) owns the resulting boundaries; [the implementation summary](../COMPLEXITY_REDUCTION_PLAN.md) locates each stage.

## Implementation and review

- Damage resolution names calculation, defense/Health payment and reaction families while preserving the original child insertion points, live liveness checks and transient Armor-depletion receipts
- Status helpers own control application/expiration/Cleanse, partial reductions, source attribution and ordered Bleed payments. Natural decay, rewarded Cleanse and detonation retain their distinct semantics
- The combat type derives from the saved aggregate. `ensureCombat` names initialization explicitly; allegiance and roster membership use distinct queries. The saved layout and format stay unchanged
- Target classification and read-only admission queries serve commands, execution, presentation and legal Auto-play candidates. Random selection, interception and group rereads remain execution work
- Battle selection uses one reducer and DOM adapter; geometry has its own hook. One preview projection supplies affected IDs, status changes and event readouts without mutating authoritative results
- Auto-play uses exhaustive benefit handling and one ranking owner, retaining numeric priorities, ordinary-hit assumptions, stable ties and the existing cycle guard. Its policy version remains 27

Review covered captured versus live values, reaction ordering, RNG consumption, control recovery, earned Bleed obligations, query/command equivalence, hidden-information boundaries, focus restoration, effect cleanup and superseded code removal. The original deterministic gameplay snapshots remain unchanged. Main's concurrent authored-kit caches, allocation reductions, temporary-card cleanup and boundary fixes were retained during reconciliation.

## Baseline and evidence scope

The initial runtime baseline was `f884cf2`. Before runtime edits, the existing focused selection passed 102 tests. Twenty-four creature ranking snapshots captured ordinary, injured, defended and talent-heavy conditions; later compacting their serialization was checked against the original commands, scores and reasons. Existing combat and fixed-input journey traces continue to serve as independent behavioral oracles.

Initial browser captures used the validated seed-42 battle checkpoint at 1280×720 with 125% text and 1920×1080 with default text. Targeted captures cover pointer selection with normal and reduced motion. Raw captures, checkpoint identities and comparison reports remain under `reports/simplification/` and `reports/review/` in the retained task checkout.

Final verification results and rendered review are recorded below when completed. Source inspection, unit tests and browser simulation do not establish native desktop, Windows packaging, physical-controller, Steam-client or Steam-Deck verification. No hosted CI result or performance gain is implied.

## Incidental verification repair

The complete talent-catalog DOM test timed out at its existing 15-second deadline on both the task and unchanged main. A diagnostic run completed without an assertion failure in 62 seconds overall. Catalog traversal now has an independent 15-second deadline per keyword, retaining every row, prerequisite and purchase assertion; exact accessible-label queries avoid repeatedly calculating every card rule name. The two multi-screen journeys retain bounded 15-second deadlines. No gameplay or test-selection policy changed. Shorter isolated timing failures were investigated separately rather than accepted as gameplay regressions.
