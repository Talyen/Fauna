# Tooltip review batch

Open `/design/tooltip-interactions/index.html`. Five independent decisions are ready consecutively: opening delay (immediate/150/350ms), preferred side, distance, fade-in duration and border contrast. Each has playable options, recommendations, Next/Previous navigation and direct shadcn tabs. You may skip or clear choices, complete several without returning to chat, and inspect Review my batch afterward.

Every individual comparison holds unrelated settings at 150ms opening delay, top placement, 12px distance, no fade and neutral border. The user's reviewed 20px glyph, 44px hit area and button interactions remain fixed. Only Review my batch combines explicit choices; undecided settings identify their baseline. Side is a preference: Radix collision handling remains active, and final screen contexts still need review. The preference batch is stored separately under `fauna-design-tooltip-picks-v1`; storage failures leave the visit usable.

Uses actual shadcn Button, Tooltip, RadioGroup, Switch and Tabs. The trigger opts out of the game's immediate pointer-move reopening using `reopenOnPointerMove={false}`, so Radix owns the real opening delay. Keyboard focus is immediate; Escape, blur, pointer leave and activation retain standard dismissal. Samples have independent providers with zero skip-delay duration so visiting an earlier sample does not bypass a later sample's delay. No production consumer changes behavior; the trigger's existing default remains true. Fade controls affect opacity only and honor reduced motion through the portal.

Review batches are the default for subsequent elements in this design session. Keep each decision independent while making multiple steps available in advance. User selection does not auto-advance before they can finish experimenting. Do not require a chat turn between choices. Record and review the batch when the user returns.

Mouse/keyboard and local checks are review evidence only. Controller, screen-context and full CI acceptance remain pending. The study does not load gameplay or game saves.

## Reviewed choices

On 2026-10-20 the user supplied: Immediate opening, Above, 8px distance, 100ms fade, Neutral border. [Recorded preferences](reviewed-choices.ts) hold this baseline in later studies. Immediate opening and a 100ms fade are compatible: information begins appearing immediately and settles over 100ms. Collision handling and reduced motion remain required. These are design preferences; production adoption is pending.

The next [artwork interaction batch](../artwork-interactions/README.md) is ready for consecutive decisions.
