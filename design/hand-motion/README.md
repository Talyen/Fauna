# Hand motion — Alchemy direction

The user chose Alchemy's card draw, discard and hand reflow animations on 2026-10-20 instead of selecting new motion independently. The production choreography is implemented in `src/ui/hand-motion.tsx`; full rendered acceptance remains pending. Retain Fauna's shadcn controls, ArtCard ownership, fixed card dimensions and current hand fan geometry.

## Inspected source

Read the local Alchemy checkout at commit `7790d47fb`:

- `Alchemy: src/lib/game-constants/ui-motion.ts`: transfer timing, flip windows, arc ratio and reflow duration.
- `Alchemy: src/features/alchemy/run-loop/battle/presentation/card-transfer-motion.ts`: travel, arc, rotation and flip interpolation.
- `Alchemy: src/features/alchemy/run-loop/battle/card-transfer-animations.ts`: draw order, right-to-left discard cascade, measured endpoints and batch speed.
- `Alchemy: src/features/alchemy/run-loop/battle/presentation/card-transfer-overlay.tsx`: live destination tracking and front/back handoff.
- `Alchemy: src/features/alchemy/run-loop/screens/battle-screen/hand-slot-reflow.ts` and `Alchemy: hand.tsx`: interrupted-pose-aware hand reflow.
- `Alchemy: src/features/alchemy/run-loop/battle/battle-transfers.ts`: owned overlay cleanup and cancellation.
- `Alchemy: src/styles/theme.css`: exponential ease-out curve.

## Choreography to carry over

- Draw: fly from the Draw Pile to the actual hand slot, scale from pile size to card size, rotate into the slot's fan angle and flip continuously from back to face (180° → 0°).
- Discard: cascade right-to-left from each actual card pose to the Discard Pile, scaling toward its measured top-card bounds, removing fan rotation and flipping face to back (0° → 180°). Use the transfer/handoff treatment rather than adding an independently chosen fade.
- Base flight duration is 500ms per card. Batches of one or two use normal speed; three use 1.4× speed (about 357ms each); four or more use 1.6× speed (312.5ms each). Cards travel sequentially.
- Travel uses cubic ease-out progress `p = 1 - (1 - t)^3`. The upward arc is `sin(πp)^2 × source height × 0.1`, with exact zero arc at endpoints. Scale and fan rotation follow the same travel progress.
- Draw flips during 28–82% of flight; discard flips during 40–95%, with ease-in-out flip timing and one uninterrupted half-turn.
- Draw flights follow the live slot position and fan angle, including movement while the hand reflows. Transfer overlays are decorative, hidden from accessibility APIs and do not intercept input.
- Remaining cards reflow over 320ms using `cubic-bezier(0.16, 1, 0.3, 1)`. Retarget from the currently visible interrupted position, not an obsolete resting slot. Alchemy batches measurements before writes and ignores displacements below 0.5px.
- Alchemy includes a 120ms completion buffer after flights and bounded slot stabilization (two stable comparisons, at most 12 frames, 2s timeout, 0.5px tolerance). Treat these as implementation references for reliable handoff, not gameplay delays to copy into Fauna.

## Fauna boundaries and acceptance

Reuse the choreography, not Alchemy's gameplay/presentation gating or component tree. Committed card movement, draw order, RNG and saves remain Fauna-owned and immediate. User input must not wait for a transfer; an interrupting action must reconcile or finish the visual presentation before acting on current committed state. No invisible control may capture input, and no card can stay hidden after cancellation.

Keep Fauna's resting artwork dimensions and aspect ratio; any transfer scaling is transient presentation between measured endpoints. Isolate flight and reflow transforms from hover, focus, selection lift and rejection shake. Use Fauna assets for card backs and piles, not imported Alchemy media. Sound candidates use the existing local library and require a listening review.

Reduced motion skips flight, flip and reflow. Leaving battle, pause, disposal, interruption and live reduced-motion changes clear owned overlays and stale callbacks, reveal the current committed hand and never replay cancelled sequences. Missing measurements settle directly to the committed layout.

Production choreography is implemented; comprehensive context validation remains pending. Cover repeated draws/discards, overlapping reflows, variable/full/empty hands, accepted input during flight, cancellation and disposal, reduced motion, focus return, correct face/back handoff and unchanged command/save behavior. Review rendered motion at Fauna's fixed card size and short viewports before acceptance; local documentation checks do not establish visual quality.

## Production adoption

The approved choreography is now implemented in Fauna through the owners listed in the [shared design system](../../Docs/DESIGN_SYSTEM.md). Full viewport, desktop, physical-controller and CI acceptance remain pending; implementation does not establish visual acceptance.
