# Button interaction study

Open `/design/button-interactions/index.html` through the development server. This isolated HTML entry uses the actual shared shadcn Button and Switch, theme tokens and current focus treatment. It does not load gameplay, audio or saves.

Compare Current, A (neutral) and B (gold edge) with real pointer hover, held clicks and keyboard focus/activation. The unavailable switch disables demo actions; Try waiting simulates 1.2 seconds of work. Accepted-action counts make activation observable. Reduce motion removes growth and transitions; the operating-system preference also applies. Gamepad navigation is not connected.

The proposals are scoped to this study. No production button behavior or approved design decision changes until reviewed. Current intentionally inherits the latest shared styles. Primary actions remain gold; ordinary actions have visible neutral boundaries.

For future component decisions in this review, provide a playable HTML comparison using real shadcn components before choosing the interaction treatment. Screenshots supplement the interaction review.
