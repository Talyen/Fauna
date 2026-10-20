# Content and artwork

`src/game/destinations.ts` owns biome locations, enemy packs, and initial encounter scaling. `src/game/content.ts` retains the stable legacy encounters and owns the species roster, card definitions, displayed effect descriptions, and encounter templates. Each species contributes exactly three unique card definitions. Content validation runs at startup and in tests. Keep IDs stable once saves are supported.

The first five species begin unlocked. Moonhart unlocks after the first journey victory. Each deployed creature contributes three cards, so the starting three-card deck grows to nine cards with a full lineup; recruitment adds defeated species to the five-slot roster. Only the deployed lineup of up to three creatures contributes cards, and free combat swaps replace cards in their existing zones. Starting lineups are remembered and optionally editable from the menu between battles. Health and knockouts persist between battles; Campfire appears beside destination choices whenever any roster creature, including a reserve or knockout, is missing at least 30% of maximum Health. Rest restores 30% maximum Health to the whole roster, capped at full Health, and returns to the same combat offers without advancing the encounter or changing RNG. It remains available while the threshold is met. There is no positioning or elemental chart.

## Artwork contracts

- **Creature cards: 4:3 landscape, full bleed.** Current placeholders are 800 × 600 SVGs.
- **Location cards: 4:3 landscape.** Original 800 × 600 SVG placeholders in `public/art/locations/`, with names and encounter labels rendered outside the artwork. `scripts/create-location-placeholders.mjs` rewrites only these placeholders.
- **Boon cards: 3:4 portrait, matching hand cards.** Boon displays use dedicated portraits in `public/art/boons/`; keep names and effects outside the artwork.
- **Action cards: 3:4 portrait, full bleed.** Current placeholders are 600 × 800 SVGs.

Displayed artwork uses one equal-area size standard: 200×266⅔ portrait and 266⅔×200 landscape in CSS pixels, at every viewport. Battle explicitly enlarges creatures by 10% and reduces hand cards by 10%. Layouts reflow or scroll instead of scaling artwork; source asset resolution is independent of displayed size. See [layout rules](UI.md#layout-artwork-size-and-spacing).

These are separate compositions, not crops of one format into another. Replace the selected sources in `public/art/` or the shared library, update `assets/manifest.json` where needed, and explicitly prepare the new generation. Images use their native aspect ratio with no stretching. All text is rendered by the UI, not baked into artwork. Cards contain no text or UI overlays; names, stats and rules live in hover/focus details, including inside centered inspection. Stacked inspection presents three portrait action thumbnails under the creature artwork without visible captions or passive text. Selecting a thumbnail pins the complete action artwork in the same dialog; hover/focus reveals its rules. Keyboard/controller cycling has no Previous/Next buttons. Compact creature tooltips do not list actions; pinned enemy artwork reveals its collectible passive separately from battle state.

The initial asset set was authored by `scripts/create-placeholders.mjs`. Running it intentionally rewrites all placeholder SVGs; do not run it over production art. Mana UI sprites were adapted from Alchemy; no species illustrations or fonts were copied from Alchemy. Keyword artwork reuse is documented below.

## Keyword artwork

`public/art/keywords/` contains unchanged optimized portrait artwork copied from Alchemy for optional keyword illustrations. Talents currently uses text tabs and does not require artwork for each category. Use portrait ArtCards with contain rendering; the source images are 420 × 563 pixels.

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

Source directory: `Alchemy: src/assets/optimized/`. Artwork reuse does not import Alchemy's keyword mechanics. The nine original keyword illustrations are registered; additional talent categories do not require illustrations.

## Composition

The enemy row is above the player row, and the portrait hand is at the bottom. Enemy intents remain hidden. Health bars, block counts, acting outlines and targeting feedback sit outside the artwork. Defeated creatures remain visible but subdued. Important actions have visible outcomes, independent of sound. Outcome-driven floating numbers, recoil and optional recorded sound present committed actions.

Review the draft, ordinary encounters, three-enemy encounter, reward choices, enlarged inspection, and victory at 1920 × 1080 and 1280 × 800. Automatic geometry assertions supplement visual inspection; they do not establish physical handheld readability or performance.

## Prepared assets

`assets/manifest.json` owns stable media IDs, repository/library-relative source selections, copy recipes, image aspect ratios, source provenance and rights notes. Art placeholders remain authoring sources under `public/art/`; selected sound recordings and music come from `~/Documents/Asset Library` or `ASSET_LIBRARY_ROOT`. No preparation command modifies or deletes library originals.

```sh
npm run assets:prepare        # Validate sources and publish a complete generation
npm run assets:check          # Verify selected sources, recipes and output hashes
npm run assets:check:outputs  # Validate committed outputs without the source library
```

Preparation reads and validates all selected sources before publication. Output generations live under `public/prepared/<content hash>/`; `src/assets/prepared.json` is the generated lookup and receipt. The pointer changes only after all generation files are installed. Missing sources, corrupt immutable output files, or conversion/recipe failures preserve the prior pointer. Old generations are retained; cleanup is a separate explicit action. Generated files are not edited by hand. Current recipes copy selected SVG/WebP/WAV/OGG/MP3 bytes without conversion or cropping; richer encoding recipes should be introduced only for a concrete need.

Runtime artwork/audio resolves stable IDs through the generated lookup. Ordinary development and production builds run output-only checks; they never regenerate media or need access to the library. Source checks are required after media authoring. Header, geometry and hash checks do not establish audio decoding, visual suitability, source-license clearance or listening acceptance. Retain upstream source-license metadata; the manifest records the shared-library selection and provenance, not a new license grant.

Recorded sounds cover typed combat outcomes, healing, defense, rejected actions, knockouts, recruitment, talents and battle outcomes. Menu, biome and boss tracks are selected independently of Alchemy's routes. Runtime volume uses Master × Music or Master × Sound effects, with background mute and a convenient Sound toggle. Preferences are independent of saves. Audio follows committed commands, respects quiet previews, and never controls gameplay, saves or command admission. Current selections still require Fauna listening/mix review. See [Sound desk](DEVELOPMENT_TOOLS.md#prepared-media-and-sound-desk).

## Boon selections

Tattered Pages, Bone Charm, Ironwood Buckler and Icy Heart use the corresponding portrait WebP files copied from `Alchemy: src/assets/optimized/` into `public/art/boons/`. The manifest records each source, provenance and output hash. Prepared assets are Fauna-owned copies with no sibling runtime dependency. Effects and reward IDs are authored in `src/game/progression.ts`; intermediate-boss cadence is unchanged.

## Support encounter content

Merchant prices, affordability and Campfire eligibility/recovery are owned by `src/game/support.ts`. Stock selects from the existing Boon catalog and persists with each visit. Merchant currently reuses the prepared Silken Clearing location illustration, an explicit existing placeholder rather than a newly approved source-library selection. Boon portraits retain their existing asset manifests and receipts. Replace location selections through the prepared-asset workflow when final art is selected.
