# Phone design decisions

User choices from the text review on 2026-10-20. These supplement the earlier interactive studies. They record design intent only: production adoption and rendered/context acceptance remain pending. Continue with short text options while the user is on a phone; do not require HTML access or screenshots for each decision. Preserve registered shadcn/ui controls and their native behavior.

## Tabs

- Active: black fill and gold border.
- Inactive hover: subtle charcoal fill.
- Inter-tab gap: 4px; horizontal padding: 12px per side; height remains at least 44px.
- 20px Lucide icons beside labels.
- Fill/border transition: 150ms; panel activation remains immediate.
- Carry forward the single highlighted-boundary rule on combined states; retain visible native keyboard/controller focus.

## Switches

- Gold track on, gray track off; thumb position also communicates state.
- Hover subtly brightens the track, with no enlargement.
- Thumb slides over 150ms; setting takes effect immediately.
- Solid gold focus outline around the whole switch.

## Radio choices

- Selected: gold circular outline and center dot.
- Unselected hover: brighten the existing circular outline, without movement or an additional background.
- Focus: solid gold outline around the circle and label together, avoiding concentric focus rings around the circle.
- Selection visuals transition over 150ms; setting changes immediately.

## Volume sliders

- Gold filled track, gray remainder, visible percentage.
- Ivory circular thumb; hover adds a thin gold border without movement.
- Dragging thickens that same border rather than adding a ring.
- Solid gold focus outline around the whole slider control.
- Thumb/fill/value follow input immediately, with no smoothing lag.
- Keyboard/controller adjustment step: 10 percentage points.

## Dialogs and confirmations

- Backdrop: approximately 80% black dimming.
- Near-black dialog fill with a thin neutral border.
- Fade only, with no spatial movement: 150ms opening and closing.
- Destructive confirmation action: red filled button; inherit ordinary dialog and button treatments otherwise.
- Preserve shadcn/Radix modal focus ownership and focus return. Cancel receives initial focus in End journey; outside click does not dismiss that AlertDialog.

## Progress bars

- 8px track thickness, fully rounded caps.
- Fill changes animate over 150ms; committed values change immediately.
- Existing Health/keyword semantic colors and visible-number rules remain.

## Combat feedback

- Combat numbers drift upward slightly while fading, remain visible for 1 second and use semibold text.
- Simultaneous results on the same creature form a short vertical stack; retain each result's meaning and damage/healing/Block colors.
- For combatant wind-up, swing and hit reactions, use the [Alchemy direction](combat-motion/README.md). This supersedes the unanswered choice between no recoil, 2px recoil and 4px recoil. No recoil-distance option was selected in that question.
- Numbers must retain meaningful committed outcomes; motion never gates input or gameplay. Presentation-only grouping must not mutate events or extend expired feedback.

## Shared preferences

Reduced motion makes switch/radio/dialog/progress transitions immediate and disables spatial combat movement. Essential state remains visible without sound. None of these choices authorizes dropping keyboard accessibility, native control behavior, fixed artwork dimensions or the single highlighted-boundary treatment for selected-plus-hovered controls. Fine visual details still need review at a computer.
