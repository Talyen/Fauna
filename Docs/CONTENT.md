# Content and artwork

`src/game/content.ts` owns the species roster, card definitions, displayed effect descriptions, and encounter templates. Each species contributes exactly three unique card definitions. Content validation runs at startup and in tests. Keep IDs stable once saves are supported.

The first five species begin unlocked. Moonhart unlocks after the first expedition victory. Team composition changes the nine-card deck; recruitment adds defeated species to the six-slot roster. Only the active three contribute cards, and pre-battle swaps rebuild the active deck. The prototype intentionally restores all creatures after each battle and has no positioning or elemental chart.

## Artwork contracts

- **Creature cards: 4:3 landscape, full bleed.** Current placeholders are 800 × 600 SVGs.
- **Action cards: 3:4 portrait, full bleed.** Current placeholders are 600 × 800 SVGs.

These are separate compositions, not crops of one format into another. Replace the matching files in `public/art/` while retaining their names, or update the owning UI asset references together. Images use their native aspect ratio with no stretching. All text is rendered by the UI, not baked into artwork. Cards contain no text or UI overlays; names, stats and rules live in hover/focus details and centered inspection. Inspection renders the complete action card larger.

The initial asset set was authored by `scripts/create-placeholders.mjs`. Running it intentionally rewrites all placeholder SVGs; do not run it over production art. Mana UI sprites were adapted from Alchemy; no creature artwork or fonts were copied from Alchemy.

## Composition

The enemy row is above the player row, and the portrait hand is at the bottom. Enemy intents remain hidden. Health bars, block/mark counts, acting outlines and targeting feedback sit outside the artwork. Defeated creatures remain visible but subdued. Important actions have visible outcomes, independent of sound. Outcome-driven floating numbers, recoil and optional synthesized sound present committed actions.

Review the draft, ordinary encounters, three-enemy encounter, reward choices, enlarged inspection, and victory at 1920 × 1080 and 1280 × 800. Automatic geometry assertions supplement visual inspection; they do not establish physical handheld readability or performance.
