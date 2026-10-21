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

## Screen navigation transitions

- Moving between menu screens uses a 150ms crossfade.
- Entering battle uses a 250ms fade, with no spatial movement.
- Returning from inspection crossfades to the preserved parent over 150ms. Preserve parent state and native focus return; do not add a second sequential fade on top of the dialog closing transition.
- Reduced motion makes these transitions immediate. Navigation and committed gameplay never wait for animation; outgoing surfaces cannot retain input or focus ownership during the transition.

## Progress bars

- 8px track thickness, fully rounded caps.
- Fill changes animate over 150ms; committed values change immediately.
- Existing Health/keyword semantic colors and visible-number rules remain.

## Health and Block previews

- Predicted Health loss uses static stripes over the portion that would be lost.
- Predicted healing uses a translucent green segment showing the gain.
- Block changes show the current amount → predicted amount, including zero when depleted.
- A lethal outcome uses a small skull beside the Health bar.
- Previews update immediately and disappear on cancellation. Health totals remain in tooltips and inspection; previews never commit gameplay.

## Combat feedback

- Combat numbers drift upward slightly while fading, remain visible for 1 second and use semibold text.
- Simultaneous results on the same creature form a short vertical stack; retain each result's meaning and damage/healing/Block colors.
- For combatant wind-up, swing and hit reactions, use the [Alchemy direction](combat-motion/README.md). This supersedes the unanswered choice between no recoil, 2px recoil and 4px recoil. No recoil-distance option was selected in that question.
- Numbers must retain meaningful committed outcomes; motion never gates input or gameplay. Presentation-only grouping must not mutate events or extend expired feedback.

## Status effects

- Icons only: names, counts and explanations appear in immediate hover/focus tooltips, not beside the icons. Accessible descriptions retain the same details. This supersedes the earlier tentative icon-plus-count direction.
- Fixed catalog order, not dynamic urgency sorting.
- Newly added status: scale from 90% to 110%, then settle at normal size over 200ms.
- Existing status count changes: a small icon pulse, without replaying the full entrance bounce; tooltip data updates immediately.
- When the effect ends: 150ms fade-out. Reaching zero uses removal feedback rather than also triggering a count-change pulse.
- Reduced motion makes entrance/removal immediate and suppresses the pulse.

## Targeting

- Highlight only the current target; other valid candidates retain their normal border.
- A thin, steady muted-gold line connects acting creature and target. No line glow or animation.
- Invalid targets use 45% opacity and remain inspectable.
- Preserve the single highlighted-boundary rule when targeting overlaps selection or hover. Target validity and action acceptance remain gameplay-owned.

## Rejected action-card input

- Attempting to play an unavailable card gives a brief sideways shake. Sound is supplementary.
- Reduced motion uses a static border cue instead of shaking; do not add an extra ring.
- Rejected input cannot change committed gameplay, RNG, Mana or saves. No shake duration or distance was chosen in this phone question; existing bounded values remain the implementation baseline pending rendered review.

## Interface audio

- Menu and settings activation uses a quiet, soft click. Hover and keyboard/controller focus navigation remain silent.
- Rejected actions use a short, soft denial cue distinct from activation. All cues respect the Sound setting.
- Audition candidates from the existing local library at `~/Documents/Asset Library/Sounds/Game Sources`; preserve source originals and use the project's asset manifest/preparation workflow. Verified candidates include Alchemy's `interface/toggles/toggle_on_02.wav`, `toggle_off_02.wav` and `interface/feedback/denied.wav` under `Projects/Alchemy/Sound Effects`. Discovery does not constitute listening approval or selection of a specific clip.

## Error messages

- Use a Lucide warning icon alongside a concise, plain-language message. Offer a relevant action such as Retry when available.
- Action errors appear inline beside the affected control and remain until resolved or retried. Global errors, such as a failed save, use a persistent notice with Retry when available.
- Error messages appear immediately, with no entrance animation.
- Warning icons use muted red; message text uses the normal light text color.
- Essential meaning remains visible without sound.

## Screen loading

- When opening a screen, show a spinner only if loading lasts longer than 200ms. Content appears as soon as it is ready; the delay applies only to the loading indicator.
- Use a small neutral spinner beside the visible label “Loading…”.
- During refresh, keep existing content visible at normal contrast and show a small loading indicator nearby.

## Mana crystals

- Keep the existing Alchemy crystal artwork and use a subtle hover glint.
- Card-cost previews softly dim the crystals that would be spent; previewing never spends Mana.
- Spending fades to the spent appearance over 150ms; refilling fades to the full appearance over 150ms.
- Committed Mana values update immediately. Reduced motion removes the glint and makes spending/refill appearance changes immediate.

## Hand motion

- Use [Alchemy's draw, discard and hand reflow choreography](hand-motion/README.md), including its curved flip flights, batch speed and 320ms interrupted-pose-aware reflow. This supersedes the unanswered proposed 150ms hand reflow and independently chosen draw/discard options.
- Retain Fauna's fixed card sizes, fan layout, shadcn controls and nonblocking committed gameplay. Production adoption and rendered acceptance remain pending.

## Draw and Discard Piles

- Hover: gold border and 3.5% growth.
- Keyboard/controller focus: solid gold outline and 3.5% growth. Preserve the single highlighted-boundary rule when focus overlaps hover.
- Press: shrink 2%, matching buttons.
- Empty piles remain inspectable and show the chosen empty-state icon inside their inspection view.
- Pile counts remain hidden. Browsing never changes card order.

## Collection paging

- Use Lucide arrow icons only, without tooltips; retain accessible Previous/Next names.
- Place paging controls below the creature grid. Reserve the space of each hidden arrow so the remaining control does not shift.
- Changing Collection filters starts at the first page.
- Page content changes immediately, without a crossfade, and the creature grid returns to its top.
- Keyboard/controller focus stays on the paging control rather than moving to the first creature.
- Hide unavailable Previous/Next controls. If the focused paging control disappears at a boundary, move focus to the remaining paging control; if neither remains, use the Collection filter control as the fallback. Never leave focus on a removed element.

## Lineup and Swap

- The first selected creature uses the established gold selection ring plus a 4px lift over 150ms.
- Hovering the selected creature strengthens the same ring, preserving the single highlighted-boundary treatment.
- Unavailable swap choices use 45% opacity and remain inspectable.
- After a successful swap, animate creatures between positions over 150ms. Committed gameplay updates immediately; motion is presentation-only, never blocks input and is skipped under reduced motion.
- Swap movement uses ease-out timing and opposing arcs with a 32px peak displacement from the direct path, chosen in the interactive arc-height comparison.
- Empty reserve slots that can receive a creature use a thin dashed neutral border and a centered muted Lucide Plus. Available hover turns the existing border gold without movement. Keyboard/controller focus uses the established solid gold outline, preserving the single highlighted-boundary rule.

## Keywords in rule text

- Keywords in rule prose are plain, semibold, keyword-colored inline words, with ordinary word spacing and no added padding, margins or control-sized boxes.
- No keyword hover tooltip, hover brightening, click action or separate keyboard focus stop. Rules may already be inside an inspection tooltip; do not nest keyword interactions inside it.
- Definitions remain in the Glossary. This supersedes the earlier hover-brightening and nested keyword-detail study choices; the study now previews the accepted plain-text treatment.
- The canonical KeywordText renderer retains plain spans and now applies semibold emphasis. Full context acceptance remains pending.

## Talent controls

- Available purchases use a normal outlined control with gold on hover.
- Unmet requirements use 45% opacity and remain inspectable; explain the unmet requirement in the hover/focus tooltip.
- Unowned talent icons use their keyword color at 65% opacity; owned icons use the full keyword color.
- Owned talents use their keyword's semantic color on the talent icon, with a black background and no checkmark. Hover brightens the icon by 20% without growth.
- Successful purchases update the owned state immediately, with a 150ms color transition and a 250ms gold flash on the existing border. The flash starts gold and fades back to the resting border. Focus outline takes priority over the flash to preserve a single highlighted boundary.
- Reduced motion makes the owned color transition immediate and suppresses the decorative border flash.

## Rewards and results

- Earned amounts count upward to their final values over 400ms with ease-out timing.
- Reward items arrive with a 75ms stagger per item; artwork fades in over 150ms without spatial movement.
- Rewards commit immediately and controls remain usable immediately. Count-ups and staggered arrivals are presentation-only and cannot delay commands or grant rewards.
- Interacting during the entrance finishes the presentation immediately and accepts the intended action without requiring a second activation.
- Each keyword level-up reveal pulses the keyword icon once in its own semantic color, growing to 110% and returning to normal over 250ms total.
- Reduced motion shows final values and all reward items immediately, without entrance animations.
- Reduced motion also suppresses the level-up icon pulse.

## Empty states

- Use an icon only, with no visible message, accompanying action or hover/focus tooltip. Provide an accessible label that describes the empty state.
- Empty-state icons are 24px and muted gray.
- Center the icon within the empty content area. It appears immediately, has no hover visual change and is replaced immediately when content becomes available.

## Text and numeric presentation

- Creature and card names in inspection use semibold text.
- Changing numeric readouts, such as currency, use equal-width (tabular) digits to prevent horizontal shifting.
- Long names wrap onto another line rather than truncating with an ellipsis.
- Rule paragraphs are left-aligned.
- These choices apply to surrounding text and inspection; artwork remains free of text overlays. Preserve fixed text sizes, text-size settings and existing semantic colors.

## Scrolling areas

- Scrollbar thumbs use muted gray and appear on hover or while scrolling when content overflows.
- Hovering the thumb brightens it slightly.
- Preserve native wheel/trackpad scrolling without added smoothing, as well as standard keyboard scrolling and primitive behavior.
- Apply through supported standard primitives and shared tokens; do not build a custom scrollbar interaction state machine. Platform-forced scrollbar visibility takes precedence.

## Shared preferences

Continue the phone review in batches of independent questions so the user can answer several choices per turn.

Reduced motion makes switch/radio/dialog/progress transitions immediate and disables spatial combat movement. Essential state remains visible without sound. None of these choices authorizes dropping keyboard accessibility, native control behavior, fixed artwork dimensions or the single highlighted-boundary treatment for selected-plus-hovered controls. Fine visual details still need review at a computer.
