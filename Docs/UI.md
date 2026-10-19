# UI and typography

Fauna's screens are game surfaces. Show the cards, decision-relevant state, and actions required to play. The background is solid black (`#000`).

Do not add slogans, decorative headings, branding/navigation bars, footers, prototype labels, permanent save-success indicators, repeated instructions, or an always-visible narrative combat log. Detailed rules belong on cards or in inspection. Show save errors and recovery notices when they require attention.

## Screen content

- Draft: choose-three heading/count, creature artwork/names/health/passives, Start run.
- Battle: encounter/turn, enemy intents, both creature rows, shared hand, energy, draw/discard counts, End turn, and conditional target cancellation.
- Rewards: recruitment choices and upgrade choices with their actual effects; replacement actions appear after choosing a recruit.
- Pause: Resume, End run when active, and desktop Save & quit.
- Results: Victory or Defeat, first-win roster unlock, New run.

Creature art remains 4:3 landscape and action art 3:4 portrait, full bleed. Use on-card health changes, block/mark values, selection, and target state for feedback. Keep a visually hidden live combat announcement for assistive technology. Inspect with right-click, keyboard I, or controller X; retain keyboard/controller focus restoration and Escape/B cancellation.

## Component standard

shadcn/ui is the chosen standard for the whole UI. Its source-owned primitives and semantic theme tokens must underpin controls and specialized gameplay components alike. Creature cards, action cards, the hand, and targeting keep their game-specific compositions and artwork ratios; they are not generic website panels.

Use the Radix-backed component family demonstrated in the selected preview consistently. Add only components with actual consumers. Do not introduce Mantine, React Aria, or a second visual component system alongside it. Controls and interactive gameplay cards compose the shared Button; inspection uses the Radix-backed Dialog. Source attribution is in `Docs/SHADCN-LICENSE.txt`.

## Tokens

`src/ui/styles.css` owns semantic shadcn theme tokens and combat colors.

- Typography: locally bundled Inter Variable, regular rules, medium controls, semibold names, tabular numbers. 16px rules/controls, 20–24px names, 14px secondary information. Inspection enlarges rules to 18px and names to 26px. Font license: `Docs/FONT-LICENSE.txt`.
- Spacing: a 4px grid, using layout instead of decorative separators or panels.
- Color: pure black canvas, #111 controls, #f2f2f2 text, #b0b0b0 secondary text, #404040 borders. White primary actions. Solid selection outline, separate dashed focus outline, white targetable border. Disabled/unaffordable cards dim; knockout adds grayscale and zero health.
- Geometry: 6px corners, thin borders, no decorative shadows, glows or textures. Artwork may have a local text scrim.
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

Poison and Nature use lighter foregrounds from Alchemy's green/emerald families for readable text on black and artwork. Attack rules spell out the type; enemy intents combine the type icon, damage number and target. Healing and block clauses use their own colors; secondary rules stay neutral.

Types are content metadata, carried on damage presentation events. Existing version-one saves derive enemy types from encounter content. Types add no resistances, status effects, or damage arithmetic. Ice and Poison are reserved vocabulary until authored attacks use them.

Use shadcn/ui for dialogs, tooltips, menus, sliders, and shared controls, composing gameplay cards from the same primitives and tokens. Gamepad navigation remains an application responsibility and must be verified through these compositions. Adopting a library is not a reason to add more controls or containers.
