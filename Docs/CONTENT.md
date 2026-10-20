# Content and artwork

`src/game/destinations.ts` owns biome locations, enemy packs, and initial encounter scaling. `src/game/content.ts` retains the stable legacy encounters and owns the species roster, card definitions, displayed effect descriptions, and encounter templates. Each species contributes exactly three unique card definitions. Content validation runs at startup and in tests. Keep IDs stable once saves are supported.

The first five species begin unlocked. Moonhart unlocks after the first journey victory. Team composition changes the nine-card deck; recruitment adds defeated species to the five-slot roster. Only the active three contribute cards, and free combat swaps replace cards in their existing zones. Starting lineups are remembered and optionally editable from the menu between battles. The prototype intentionally restores all creatures after each battle and has no positioning or elemental chart.

## Artwork contracts

- **Creature cards: 4:3 landscape, full bleed.** Current placeholders are 800 × 600 SVGs.
- **Location cards: 4:3 landscape.** Original 800 × 600 SVG placeholders in `public/art/locations/`, with names and encounter labels rendered outside the artwork. `scripts/create-location-placeholders.mjs` rewrites only these placeholders.
- **Relic cards: 3:4 portrait, matching hand cards.** All current relic displays use the blank 600 × 800 `public/art/relic-placeholder.svg`. Replace with dedicated portrait illustrations later; keep names and effects outside the artwork.
- **Action cards: 3:4 portrait, full bleed.** Current placeholders are 600 × 800 SVGs.

Displayed artwork uses one equal-area size standard: at 1280×800 CSS pixels, 200×266⅔ portrait and 266⅔×200 landscape. Shared viewport and constrained-layout scaling applies to both formats together; source asset resolution is independent of displayed size. See [responsive layout](UI.md#responsive-layout-and-artwork-size).

These are separate compositions, not crops of one format into another. Replace the matching files in `public/art/` while retaining their names, or update the owning UI asset references together. Images use their native aspect ratio with no stretching. All text is rendered by the UI, not baked into artwork. Cards contain no text or UI overlays; names, stats and rules live in hover/focus details and centered inspection. Stacked inspection presents three portrait action thumbnails under the creature and passive. Selecting a thumbnail enlarges the complete action card in the same dialog, with Previous/Next cycling. Compact creature tooltips no longer list actions; enemy inspection labels collectible kit separately from battle state.

The initial asset set was authored by `scripts/create-placeholders.mjs`. Running it intentionally rewrites all placeholder SVGs; do not run it over production art. Mana UI sprites were adapted from Alchemy; no creature artwork or fonts were copied from Alchemy.

## Keyword artwork

`public/art/keywords/` contains unchanged optimized portrait artwork copied from Alchemy for the Talents keyword overview. Use portrait ArtCards with contain rendering; the source images are 420 × 563 pixels.

| Fauna keyword | Local file       | Alchemy source         |
| ------------- | ---------------- | ---------------------- |
| Physical      | `physical.webp`  | `talent-physical.webp` |
| Fire          | `fire.webp`      | `talent-burn.webp`     |
| Ice           | `ice.webp`       | `talent-freeze.webp`   |
| Lightning     | `lightning.webp` | `talent-stun.webp`     |
| Poison        | `poison.webp`    | `talent-poison.webp`   |
| Nature        | `nature.webp`    | `talent-nature.webp`   |
| Light         | `light.webp`     | `talent-holy.webp`     |
| Block         | `block.webp`     | `talent-block.webp`    |
| Healing       | `heal.webp`      | `talent-health.webp`   |

Source files live in Alchemy's `src/assets/optimized/`. Artwork reuse does not import Alchemy's keyword mechanics. All nine talent categories have matching artwork.

## Composition

The enemy row is above the player row, and the portrait hand is at the bottom. Enemy intents remain hidden. Health bars, block counts, acting outlines and targeting feedback sit outside the artwork. Defeated creatures remain visible but subdued. Important actions have visible outcomes, independent of sound. Outcome-driven floating numbers, recoil and optional synthesized sound present committed actions.

Review the draft, ordinary encounters, three-enemy encounter, reward choices, enlarged inspection, and victory at 1920 × 1080 and 1280 × 800. Automatic geometry assertions supplement visual inspection; they do not establish physical handheld readability or performance.
