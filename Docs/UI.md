# UI and typography

Fauna's screens are game surfaces. Show the cards, decision-relevant state, and actions required to play. The background is solid black (`#000`).

Do not add slogans, decorative headings, branding/navigation bars, footers, prototype labels, permanent save-success indicators, repeated instructions, or an always-visible narrative combat log. Detailed rules belong in hover/focus tooltips or pinned inspection. Show save errors and recovery notices when they require attention.

## Screen content

- Draft: choose-three heading/count, artwork-only creature choices with names/health/passives in tooltips, Start run.
- Battle: encounter/turn, enemy intents, both creature rows, shared hand, mana, draw/discard counts, End turn, and conditional target cancellation.
- Rewards: recruitment choices and upgrade choices with their actual effects; replacement actions appear after choosing a recruit.
- Pause: Resume, End run when active, Glossary & controls, 100/125/150% text size, Sound on/off, and desktop Save & quit.
- Results: Victory or Defeat, first-win roster unlock, New run.

Creature art remains 4:3 landscape and action art 3:4 portrait, full bleed. Every card surface contains artwork only: no names, rules, costs, stats, badges, health bars, or readability scrims. Selection/focus borders are external interaction indicators. Combat readouts (health, active block/marks) sit outside creature artwork; enemy intent sits above the row. Passive details and names live in standard shadcn/Radix tooltips, opened by hover or keyboard/controller focus. Card tooltips include owner, cost, upgrade and the final trait/upgrade-adjusted effect with no bonus breakdown. Target-specific marks and healing caps are reflected in exact target previews. The tooltip and command share the same intrinsic-value calculation. Rewards also use artwork-only cards; upgrade tooltips show before/after effects.

Use readable 16px tooltip text and collision-aware portal positioning. Noninteractive tooltip surfaces do not intercept pointer actions on the battlefield; Radix hover grace retains readable content, and pinned inspection provides persistent interactive reading. Right-click, I or controller X opens pinned inspection. Escape/B closes or cancels one interaction layer. Glossary is a pause-menu destination, not permanent battlefield chrome.

## Targeting and previews

Select a card to enter preview mode. No mana, RNG, save revision or committed game state changes. A/D wraps across valid living targets. Remember the last valid target separately for enemies and teammates within a battle; fall back to the first living target. W/S moves between enemy, player and hand rows; A/D moves within a row when not targeting. Tab also navigates controls; arrow keys are not gameplay controls. Controller left/right does the same. Hover/focus selects the preview target; clicking that target or Enter/controller A confirms. Team-wide cards also require confirmation after preview. Escape/B cancels and restores the hand focus. End turn commits immediately, including while targeting; it never opens a confirmation. Playing the last mana automatically resolves the enemy turn. The selected-action readout flags a last-mana play.

Previews call the authoritative pure gameplay command and discard its result. Target readouts show exact health/block/mark changes and knockouts, including traits, upgrades, mark consumption and capped healing. General card tooltips are suppressed during targeting to keep targets and confirmation controls reachable. I/X remains available for pinned rules.

## Floating combat feedback

Starting point: Alchemy's `Docs/UI_BATTLE.md`, `combat-feedback-model.ts` and combat-text renderer. Fauna uses compact icon/number bursts anchored above affected creatures, outside artwork. Numbers show actual health lost/healed, block gained/spent, marks and knockout; no prose overlays. Damage retains type color; block uses blue; healing uses health red.

Group matching recipient/kind/type/direction during the first 250ms of a burst without restarting its 1400ms lifetime. Keep different types and gain/loss directions separate; cap at three groups per target. Enemy feedback is shown in action order at 300ms intervals, including each attack's absorption and retaliation. A fresh accepted command interrupts any unshown feedback so presentation never holds up input. Feedback is transient presentation, never saved or replayed on resume. It never delays input, commands or saves. Reduced motion shows stationary bursts for the same duration. Unmount disposes subscriptions and timers. Actual events retain a polite screen-reader announcement.

## Accessibility baseline

Keep native semantic buttons, Tab navigation, focus outlines, a trapped/dismissible inspection dialog and reliable return focus. Tooltips are not the only way to read rules: pinned inspection provides persistent readable content. Numbers/icons and named types accompany colors. Respect OS reduced motion. Text size is adjustable to 100/125/150% in Pause and stored separately from expedition saves; denied preference storage must not prevent play. Enlarged text can scroll in tooltips/dialogs rather than being clipped. These features require physical-controller/Steam Deck checks separately from simulated browser input.

See [Glossary](GLOSSARY.md) for canonical terminology.

## Component standard

shadcn/ui is the chosen standard for the whole UI. Its source-owned primitives and semantic theme tokens must underpin controls and specialized gameplay components alike. Creature cards, action cards, the hand, and targeting keep their game-specific compositions and artwork ratios; they are not generic website panels.

Use the Radix-backed component family demonstrated in the selected preview consistently. Add only components with actual consumers. Do not introduce Mantine, React Aria, or a second visual component system alongside it. Controls and interactive gameplay cards compose the shared Button; inspection uses the Radix-backed Dialog. Source attribution is in `Docs/SHADCN-LICENSE.txt`.

## Tokens

`src/ui/styles.css` owns semantic shadcn theme tokens and combat colors.

- Typography: locally bundled Inter Variable, regular rules, medium controls, semibold names, tabular numbers. 16px rules/controls, 20–24px names, 14px secondary information. Inspection enlarges rules to 18px and names to 26px. Font license: `Docs/FONT-LICENSE.txt`.
- Spacing: a 4px grid, using layout instead of decorative separators or panels.
- Color: pure black canvas, #111 controls, #f2f2f2 text, #b0b0b0 secondary text, #404040 borders. White primary actions. Solid selection outline, separate dashed focus outline, white targetable border. Disabled/unaffordable cards dim; knockout adds grayscale and zero health.
- Geometry: 6px corners, thin borders, no decorative shadows, glows or textures. Artwork has no UI scrim.
- Motion: 150ms purposeful transitions; respect reduced motion. Gameplay commits before visual feedback and input never waits on animations.
- Icons: Lucide, with labels/numbers so color is never the only cue.

## Combat vocabulary

Adapted from Alchemy's `src/lib/game-data/keywords.ts` palette and `src/features/alchemy/shared/config/metadata.ts` icon pairings. Health uses red (#f87171, Heart), block sky blue (#7dd3fc, Shield), and marks stay neutral (Crosshair). Damage color follows the attack type, independent of lost health:

| Type      | Foreground | Icon         |
| --------- | ---------- | ------------ |
| Physical  | #cbd5e1    | Swords       |
| Fire      | #fb923c    | Flame        |
| Ice       | #67e8f9    | Snowflake    |
| Lightning | #fcd34d    | Zap          |
| Poison    | #86efac    | FlaskConical |
| Nature    | #34d399    | Leaf         |
| Light     | #fde68a    | Sun          |

Poison and Nature use lighter foregrounds from Alchemy's green/emerald families for readable text on black and artwork. Tooltip attack rules spell out the type; external enemy intents combine the type icon, damage number and target. Healing and block clauses use their own colors; secondary rules stay neutral.

Types are content metadata, carried on damage presentation events. Existing version-one saves derive enemy types from encounter content. Types add no resistances, status effects, or damage arithmetic. Ice and Poison are reserved vocabulary until authored attacks use them.

Use shadcn/ui for dialogs, tooltips, menus, sliders, and shared controls, composing gameplay cards from the same primitives and tokens. Gamepad navigation remains an application responsibility and must be verified through these compositions. Adopting a library is not a reason to add more controls or containers.

## Combat movement and sound

Adapt Alchemy's outcome-driven impact/cue selection and bounded recoil rather than copying its artwork or audio assets. Each presented action selects one strongest nonzero cue, with damage winning ties over healing and block. Positive health loss applies a short 180ms, 4px portrait recoil; fully absorbed and ineffective hits have no health-loss recoil. Recoil is bounded per creature and disabled with reduced motion. Floating feedback retains its damage type and timing.

Original synthesized cues distinguish damage families, healing, gaining block, absorption and marks. Audio unlocks on user interaction and is optional; unavailable devices or autoplay denial cannot interrupt play. Desktop autoplay supports controller-only play. Pause offers a persistent Sound on/off setting. Sounds, animation handles, listeners and pending timers are disposed on teardown; visual aggregation never invents extra impacts or sounds.
