# Button interaction study

Open `/design/button-interactions/index.html` through the development server. This isolated HTML entry uses the actual shared shadcn Button, Switch, RadioGroup and Tabs. It does not load gameplay, audio or game saves.

Review one behavior at a time: hover fill, hover border, hover movement, focus fill, focus border, focus outline, focus movement, pressed fill, pressed border, pressed movement, transition timing, unavailable contrast and busy indicator. Each has multiple playable options with all unrelated effects held constant. A visible dashed keyboard focus outline remains the baseline except when explicitly comparing focus outlines. Switch between supporting and primary buttons to test the same decision on each role. Reduced motion also respects the operating-system preference.

Choose options independently with the radio controls; Clear this choice restores an undecided behavior. Provisional choices persist in browser storage under `fauna-design-button-picks-v1`; storage failure leaves the current session usable. Combine my choices applies only explicit choices and lists undecided behaviors. Unavailable and busy treatments can be previewed separately there. No production styles or approved design decisions change until the combination is reviewed. Mouse and native keyboard behavior are connected; gamepad navigation is not.

The [component review queue](../UI_REVIEW.md) extends this method to every current UI element and its applicable states. For this review, playable HTML comparisons precede decisions; screenshots supplement them. Do not bundle independent variables into competing visual packages.
