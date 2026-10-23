# Battle rewards review sample

Historical reward-flow study. Its Continue/Skip/relic behavior describes the fixture below, not current gameplay. Use [journey rules](../../Docs/EXPEDITION_DESIGN.md#screen-flow-and-journey-results) and [reward presentation](../../Docs/ui/screens.md#victory-recruitment-and-team-confirmation) for current behavior.

Open `/design/battle-rewards/index.html` on the development server.

Presentation fixtures only; no gameplay, persistence, currency awards or talent purchases. Three separate screens: XP/currency → recruitment → relic choice. Continue advances from XP; recruit one creature or Skip to reach relics. Recruit and relic choices commit immediately to local presentation state. Relic selection or Skip ends this sample; reload to reset. Full-roster replacement and next-battle selection are not part of this sample.

Keyword XP values demonstrate a point earned and progress toward later points using the agreed starting thresholds. Bars and numbers show progress within the current point interval. Relic names, icons, effects and currency amounts are placeholders, not approved content. Hover/focus provides creature/relic details and the permanent currency total. No materials are shown because material types are undefined.

Uses shared typography, semantic colors, shadcn Button and Tooltip. No generated artwork.
