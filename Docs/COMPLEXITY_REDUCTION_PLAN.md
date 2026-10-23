# Combat and battle interaction simplification

The [approved assessment](archive/COMPLEXITY_REDUCTION_PLAN.md) records the proposed stages and acceptance criteria. The [implementation evidence](task-evidence/2026-10-23-complexity-reduction.md) records verification and its limits. Current contracts remain in [Architecture](ARCHITECTURE.md) and [UI](UI.md).

All implementation stages are complete:

1. Captured existing combat/journey traces and all creatures' representative Auto-play rankings before runtime edits
2. Separated pure damage arithmetic, captured payment facts and ordered reaction families while retaining the synchronous depth-first resolver
3. Centralized control transitions, harmful-stack attribution and deferred Bleed payout bookkeeping; derived the combat type from the saved aggregate and named its mutating initializer explicitly
4. Shared card admission, target classification and legal explicit recipients across command admission, execution, presentation and Auto-play
5. Separated battle selection/input, target geometry and one preview presentation model while preserving controls, focus and rendering
6. Separated legal play candidates, exhaustive visible benefit assessment and ranking weights; shared suitable arithmetic with runtime execution and preserved Auto-play cycle history

The simplification adds no saved fields or format change. Main's concurrent Reverie feature supplies Negate, development save format 54 and Auto-play policy 29; those are retained alongside its decision fixes, authored-card caches, allocation reductions, temporary-card cleanup and Steam/input changes. Narrow identity queries and transition ownership made additional persisted representations unnecessary.

Verification and protected integration are recorded in the implementation evidence. Runtime and rendered evidence qualify their recorded source and conditions; hosted CI and device-specific release gates remain separate.
