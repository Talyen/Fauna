# Content and artwork

`src/game/content.ts` owns the species roster, card definitions, displayed effect descriptions, and encounter templates. Each species contributes exactly three unique card definitions. Content validation runs at startup and in tests. Keep IDs stable once saves are supported.

The first five species begin unlocked. Moonhart unlocks after the first expedition victory. Team composition changes the nine-card deck; recruitment replaces a teammate's three cards and removes their upgrades. The prototype intentionally restores all creatures after each battle and has no positioning or elemental chart.

## Artwork contracts

- **Creature cards: 4:3 landscape, full bleed.** Current placeholders are 800 × 600 SVGs.
- **Action cards: 3:4 portrait, full bleed.** Current placeholders are 600 × 800 SVGs.

These are separate compositions, not crops of one format into another. Replace the matching files in `public/art/` while retaining their names, or update the owning UI asset references together. Images use their native aspect ratio with no stretching. All text is rendered by the UI, not baked into artwork. Leave composition room for small top badges and a lower name/effect overlay. Inspection renders the complete action card larger.

The initial asset set was authored by `scripts/create-placeholders.mjs`. Running it intentionally rewrites all placeholder SVGs; do not run it over production art. No external artwork or fonts were copied from Alchemy.

## Composition

The enemy row is above the player row, and the portrait hand is at the bottom. Enemies show damage and intended target; allies show individual health, current block, and acting-creature selection. Defeated creatures remain visible but subdued. Important actions have visible outcomes, independent of sound. The prototype has no audio assets or audio system yet.

Review the draft, ordinary encounters, three-enemy encounter, reward choices, enlarged inspection, and victory at 1920 × 1080 and 1280 × 800. Automatic geometry assertions supplement visual inspection; they do not establish physical handheld readability or performance.
