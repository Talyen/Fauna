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

Use the Radix-backed component family demonstrated in the selected preview consistently. Add only components with actual consumers. Do not introduce Mantine, React Aria, or a second visual component system alongside it. Current native controls still require migration; the library choice does not imply that migration is complete.

## Tokens

`src/ui/styles.css` owns the design tokens. The current neutral baseline uses Arial/Helvetica/sans-serif for UI and names, with tabular numbers. The component-library decision is locked; a final typeface and refinements to the remaining visual tokens are still open.

- Type: 14px rules and secondary state, 16px controls/health, 20px card names, 22px screen prompts and energy. Enlarge inspection text to 18px rules and 26px names.
- Spacing: 4, 8, 12, 16, 24, 32px, using layout instead of separators or panels to establish groups.
- Color: black canvas, `#111` control surface, `#f2f2f2` text, `#b0b0b0` secondary text, `#404040` control borders. White outlines communicate selection/focus; green health, blue block, and pink marks retain numeric/text equivalents.
- Geometry: 3px radius; no decorative shadows, glows, textures, or background gradients. Artwork may have a local scrim for readable card text.

Use shadcn/ui for dialogs, tooltips, menus, sliders, and shared controls, composing gameplay cards from the same primitives and tokens. Gamepad navigation remains an application responsibility and must be verified through these compositions. Adopting a library is not a reason to add more controls or containers.
