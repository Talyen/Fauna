# Combatant motion — Alchemy direction

The user chose Alchemy's wind-up, swing and hit reactions instead of individually selecting a new recoil distance on 2026-10-20. The choreography is implemented in Fauna. Retain shadcn controls and ArtCard; do not import Alchemy's control components or change Fauna's gameplay rules.

## Evidence scope

These notes record the October 20, 2026 adoption. Full viewport, desktop, physical-controller and CI acceptance were pending; implementation does not establish visual acceptance of current main. The source identities, choreography and checks below retain that historical scope.

## Inspected source

Read the local Alchemy checkout at commit `7790d47fb`:

- `Alchemy: src/styles/keyframes.css`: `combatant-attack-lunge`, `combatant-cast-brace`, `portraitRecoil`.
- `Alchemy: src/lib/game-constants/battle-timing.ts`: 950ms attack, 520ms support brace.
- `Alchemy: src/features/alchemy/run-loop/battle/presentation/ui/combatant-attack-lunge.tsx`: attack/cast tokens and animation restart ownership.
- `Alchemy: src/features/alchemy/run-loop/battle/presentation/ui/actor-panel.tsx` and `Alchemy: src/styles/components.css`: bounded recoil, strength thresholds and 180ms recoil duration.
- `Alchemy: src/features/alchemy/run-loop/battle/combat-feedback.ts`: presentation cleanup and 180ms repeated-recoil cooldown; gameplay outcomes and sounds do not wait on visual recovery.

## Choreography to carry over

| Phase                   | Alchemy reference                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attack begins           | Neutral transform; cubic-bezier(0.25, 0, 0.15, 1) toward wind-up                                                                                                                                                           |
| Wind-up, 16% / 152ms    | Pull back 8px; scale 0.97 × 1.03; rotate 2 degrees away from aim                                                                                                                                                           |
| Swing apex, 24% / 228ms | Move forward 30px; scale 1.06 × 0.94; rotate 3 degrees into aim; fast cubic-bezier(0.08, 0.92, 0.18, 1) approach                                                                                                           |
| Recovery to 950ms       | Return to neutral with cubic-bezier(0.2, 1, 0.36, 1)                                                                                                                                                                       |
| Support action          | 520ms brace: at 30%, move down 6px and squash to 1.05 × 0.95; at 60%, rise 2px and stretch to 0.985 × 1.015; return to neutral                                                                                             |
| Hit reaction            | 180ms recoil: neutral → full recoil at 22% → 35% counter-recoil at 55% → neutral                                                                                                                                           |
| Hit strength            | Alchemy uses 3/6/10px for light/normal/heavy, with Health-loss thresholds at 5% and 20% of maximum Health; periodic effects are light. Use this as the rendered-review baseline rather than inventing another motion style |

Alchemy attacks along its horizontal opposing sides. Fauna must aim the adaptation toward the opposing battlefield row: deployed allies toward enemies above; enemies toward allies below. Preserve phase proportions, squash/stretch and recovery feel; fixed CSS-pixel artwork sizes remain unchanged at rest. Do not import Alchemy's viewport density scaling.

Use a dedicated presentation wrapper so wind-up/swing/recoil cannot overwrite ArtCard's hover/focus scale, selection treatment or native control behavior. Keep numbers and target feedback anchored coherently when the frame moves. Review scale and overlap at Fauna's battle artwork size before accepting the adaptation.

## Outcome and lifecycle boundaries

- Present committed actions only. Browsing, hovering, targeting previews and rejected commands never produce an attack or hit reaction.
- Distinguish attacks from support actions using committed semantic event facts, not localized prose or a guessed relationship between events. Dodged or fully blocked attacks can still swing, but Fauna keeps its existing rule that positive Health loss is required for Health-loss recoil. Do not add red flash, spark overlays or screen shake merely because they exist in Alchemy.
- Keep damage, Health, Mana, RNG and save ordering immediate. Wind-up and recovery never delay command acceptance or decide gameplay. Review visual contact timing separately from committed state timing.
- Keep attack, support and target reaction ownership separate; bound repeated motion and replace or cancel stale animation handles. Preserve enemy presentation order.
- Pause, leaving battle, new accepted input where it interrupts the existing presentation, disposal and live reduced-motion changes must cancel pending phases and return frames to neutral. Cancelled sequences never replay on resume. Reduced motion keeps the essential numbers/state feedback without spatial motion; sound remains supplementary.

## Implementation ownership and acceptance

Presentation owners are `src/ui/battle/combat-impact.ts`, `src/ui/battle/combat-feedback.tsx` and the separate motion/reaction wrappers in `src/ui/shared/cards/cards.tsx`. Committed events distinguish attack/support/swap. Ownership tests cover interruption, reduced motion and disposal; required review also covers classification, blocked/zero/periodic damage, repeated/overlapping actions, transform isolation and unchanged gameplay/saves. Render both attack directions at short viewports.

## Production adoption

Current implementation ownership is mapped in the [design system](../../Docs/DESIGN_SYSTEM.md); new work follows [required rendered review](../../Docs/UI.md#required-review).
