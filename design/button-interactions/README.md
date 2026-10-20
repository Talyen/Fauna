# Button interaction study

Open `/design/button-interactions/index.html` through the development server. This isolated HTML entry uses the actual shared shadcn Button, Switch, RadioGroup and Tabs. It does not load gameplay, audio or game saves.

Review one behavior at a time: hover fill, hover border, hover movement, focus fill, focus border, focus outline, focus movement, pressed fill, pressed border, pressed movement, transition timing, unavailable contrast and busy indicator. Each has multiple playable options with all unrelated effects held constant. A visible dashed keyboard focus outline remains the baseline except when explicitly comparing focus outlines. Switch between supporting and primary buttons to test the same decision on each role. Reduced motion also respects the operating-system preference.

Choose options independently with the radio controls; Clear this choice restores an undecided behavior. Provisional choices persist in browser storage under `fauna-design-button-picks-v1`; storage failure leaves the current session usable. Combine my choices applies only explicit choices and lists undecided behaviors. Unavailable and busy treatments can be previewed separately there. No production styles or approved design decisions change until the combination is reviewed. Mouse and native keyboard behavior are connected; gamepad navigation is not.

The [component review queue](../UI_REVIEW.md) extends this method to every current UI element and its applicable states. For this review, playable HTML comparisons precede decisions; screenshots supplement them. Do not bundle independent variables into competing visual packages.

## Choices reviewed on 2026-10-20

The user's combined view showed all 13 decisions completed. They are recorded in [reviewed choices](reviewed-choices.ts) as a baseline for later studies: subtle hover/press fills, gold hover/press borders, 3.5% hover/focus growth, no focus fill change, unchanged focus border, solid focus outline, 2% pressed shrink, 150ms transitions, 50% unavailable contrast, and text with spinner for busy feedback.

The combination retains a separate external focus outline and clear movement on press. Subtle hover and pressed fills match on supporting buttons, so movement supplies their additional pressed cue. Gold borders add little contrast on gold primary buttons. Selection rings must remain distinguishable from the solid focus outline when selectable elements are reviewed. Reduced motion overrides movement. These preferences are recorded for design review; production adoption and full screen/controller acceptance remain pending.
