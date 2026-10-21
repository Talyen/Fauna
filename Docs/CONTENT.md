# Content and artwork

`src/game/encounters.ts` owns encounter progression, enemy packs, and initial encounter scaling. `src/game/content.ts` retains the stable legacy encounters and owns the species roster, card definitions, displayed effect descriptions, and encounter templates. Each species contributes exactly three unique card definitions. Content validation runs at startup and in tests. Keep IDs stable once saves are supported.

The first five species begin unlocked. Moonhart unlocks after the first journey victory. Each deployed creature contributes three cards, so the starting three-card deck grows to nine cards with a full lineup; recruitment adds defeated species to the five-slot roster. Only the deployed lineup of up to three creatures contributes cards, and free combat swaps replace cards in their existing zones. Starting lineups are remembered and optionally editable from the menu between battles. Health and knockouts persist between battles; Campfire appears beside the encounter whenever any roster creature, including a reserve or knockout, is missing at least 30% of maximum Health. Rest restores 30% maximum Health to the whole roster, capped at full Health, and returns to the same combat encounter without advancing the encounter or changing RNG. It remains available while the threshold is met. There is no positioning or elemental chart.

## Ability costs

Every ability, for every creature, has a base cost of exactly **1 Mana**. This applies to all current and future action cards, including attacks, defense, healing and utility. Balance abilities through their damage, protection, status effects and other values rather than varying their authored Mana cost. Card upgrades retain the same base cost. Explicit gameplay modifiers such as talents that make a play free still apply at runtime.

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
| Burn          | `fire.webp`      | `talent-burn.webp`     |
| Freeze        | `ice.webp`       | `talent-freeze.webp`   |
| Stun          | `lightning.webp` | `talent-stun.webp`     |
| Poison        | `poison.webp`    | `talent-poison.webp`   |
| Nature        | `nature.webp`    | `talent-nature.webp`   |
| Light         | `light.webp`     | `talent-holy.webp`     |
| Block         | `block.webp`     | `talent-block.webp`    |
| Health        | `heal.webp`      | `talent-health.webp`   |

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

Preparation reads and validates all selected sources before publication. Output generations live under `public/prepared/<content hash>/`; `src/assets/prepared.json` is the generated lookup and receipt. The pointer changes only after all generation files are installed. Missing sources, corrupt immutable output files, or conversion/recipe failures preserve the prior pointer. Old generations are retained; cleanup is a separate explicit action. Generated files are not edited by hand. Current recipes copy selected SVG/PNG/WebP/WAV/OGG/MP3 bytes without conversion or cropping; richer encoding recipes should be introduced only for a concrete need.

Runtime artwork/audio resolves stable IDs through the generated lookup. Ordinary development and production builds run output-only checks; they never regenerate media or need access to the library. Source checks are required after media authoring. Header, geometry and hash checks do not establish audio decoding, visual suitability, source-license clearance or listening acceptance. Retain upstream source-license metadata; the manifest records the shared-library selection and provenance, not a new license grant.

Recorded sounds cover typed combat outcomes, healing, defense, rejected actions, knockouts, recruitment, talents and battle outcomes. Menu, combat and boss tracks are selected independently of Alchemy's routes. Runtime volume uses Master × Music or Master × Sound effects, with background mute and a convenient Sound toggle. Preferences are independent of saves. Audio follows committed commands, respects quiet previews, and never controls gameplay, saves or command admission. Current selections still require Fauna listening/mix review. See [Sound desk](DEVELOPMENT_TOOLS.md#prepared-media-and-sound-desk).

## Boon selections

All 18 Boons use the corresponding portrait WebP files copied from `Alchemy: src/assets/optimized/` into `public/art/boons/`. The manifest records each source, provenance and output hash. Prepared assets are Fauna-owned copies with no sibling runtime dependency. Effects and reward IDs are authored in `src/game/progression.ts`; intermediate-boss cadence is unchanged.

The 18 Boons share the same unowned reward and Merchant pools. Meteorite doubles the first allied direct Burn hit each battle, including supplemental Burn; a Dodge does not consume it. Its battle-wide receipt survives saves and swaps and resets only at the next battle. Sin-Eater's Lantern restores 6 Health per harmful effect actually removed by Cleanse and combines with Renewal. Thunderstone deals one derived 6 Nature damage packet when an allied hit successfully Stuns an enemy; it does not reapply statuses or retaliate. Grove's Favor grants the healed creature 1 Thorns per actual allied healing packet in battle; full-Health attempts and Campfire recovery grant none. Prepared portraits still require rendered review.

The remaining compatible Alchemy Boons are Brass Censer, Parasitic Bloom, Cutpurse Knife, Merchant's Favor, Plague Doctor's Mask, Sundering Charm, Resonant Chimes, Smuggler's Map, Frozen Pocketwatch and Lucky Clover. Light replaces Alchemy's Holy wording. Forge, Consume, Wish, Potion and Companion Boons remain excluded because Fauna has no matching mechanics.

Brass Censer gives allied Light hits a 20% chance to either deal their damage again as Burn or Leech, with an equal split. Parasitic Bloom gives allied Poison hits and attributed ticks a 10% chance to Leech. Cutpurse Knife grants 1 Gold per allied Bleed hit or attributed tick that removes Health. Lucky Clover gives allied Nature hits a 10% chance to grant Gold equal to Health lost. These effects use seeded combat randomness and existing capped earnings and healing owners; derived damage cannot recursively trigger Brass Censer or Lucky Clover.

Sundering Charm removes 2 enemy Armor before Physical or Stun hit mitigation, after Dodge. Frozen Pocketwatch extends enemy Freeze to two skipped turns, followed by the existing shared immunity. Before allied turn-start damage, Plague Doctor's Mask removes up to 2 Poison from each living creature, including reserves, and deals half the removed amount (rounded normally) as Poison to the first living enemy. Fully removing Poison triggers Cleanse rewards; partial stack removal does not.

Resonant Chimes refunds 1 shared Mana after the third accepted card of each turn, before automatic end turn. Repeated card effects count once. Its capped battle-wide counter survives previews, swaps and resume and resets each turn and battle. Merchant's Favor commits a 13 Gold price instead of 20 when each new Merchant stock is prepared; the one-purchase visit limit still applies. Smuggler's Map adds 2 Gold to victory rewards, including bosses, using ordinary settlement and retained-earnings limits. Save version 24 rejects obsolete development saves.

## Support encounter content

Merchant prices, affordability and Campfire eligibility/recovery are owned by `src/game/support.ts`. Stock selects from the existing Boon catalog and persists with each visit. Merchant currently reuses the prepared Silken Clearing location illustration, an explicit existing placeholder rather than a newly approved source-library selection. Boon portraits retain their existing asset manifests and receipts. Replace location selections through the prepared-asset workflow when final art is selected.

## Encounter placeholders

Ordinary Combat uses an original blank 4:3 SVG placeholder; the preserved Boss placeholder is retained in the manifest. Both original files remain in `public/art/encounters/`, registered as `encounter.combat` and `encounter.boss`. Labels remain outside the artwork. Enemy packs and encounter progression live in `src/game/encounters.ts`; named destination selection is removed. The existing location assets remain available for support artwork.

Journeys use one shared combat enemy pool, with bosses at encounters 4 and 8. There are no biome divisions. Combat music reuses the prepared track registered as `music.fernwood`; that source ID does not select progression. Boss entrances show their authored name and species artwork with base-trait hover/focus details. Ordinary encounters retain the blank Combat entrance. Activating either starts the saved battle directly, without revealing turn intents or opening a preview dialog.

## Creature passive tiers

Each species in `src/game/content.ts` owns six `passiveTiers`, indexed by stars from zero through five. The first recruitment collects the species at zero stars; the sixth reaches five. Counts persist across journeys and cap at six. Committing the first onboarding starter supplies one initial copy. Later starter drafts and encounter discovery do not grant copies.

The base tier contains the existing unique passive. Higher slots remain `null` until designed, except Mossguard's six authored Overgrowth tiers. A defined tier replaces the whole previous passive rather than adding to it; include all retained effects in its effect list. Tiers can compose card bonuses and battle-start Block, Armor or Thorns. Favor recurring, species-exclusive passive mechanics independent of named abilities. New mechanics belong in the typed passive effect contract and its gameplay consumers alongside matching descriptions and regression coverage. Player rules, previews and inspection use the highest defined tier at or below the permanent rank. Enemies always use the base tier. Inspection shows all six slots, the current rank, the active effect and undefined upgrades.

## Battle pile artwork

`public/art/battle/draw-pile.webp`, `discard-pile.webp` and `card-back.webp` are unchanged 420×560 optimized artwork copied from `Alchemy: src/assets/optimized/`, with reuse explicitly requested by the user. The prepared manifest owns `pile.draw`, `pile.discard` and `card.back`; runtime has no sibling-project dependency. Draw and discard ArtCards preserve the 3:4 aspect ratio. Flying discards use the same top-card crop and landing bounds as Alchemy: x=25/420, y=25/560, width=328/420, height=432/560. The source library, original placeholders and earlier immutable prepared generations remain preserved.

## Talent category portraits

Armor, Bleed, Dodge, Leech and Mana now use their distinct existing Alchemy portraits, copied unchanged from `Alchemy: src/assets/optimized/talent-<keyword>.webp` into `public/art/keywords/`. These follow the existing Alchemy keyword-art reuse, with source provenance in `assets/manifest.json` and Fauna-owned prepared outputs. There is no runtime dependency on Alchemy.

## Emberback

Emberback is an armored brawler with 30 Health. Its base passive, Banked Furnace, starts each battle with 2 Armor; higher passive tiers remain undefined. It appears in ordinary combat packs and becomes collectible through the existing recruitment flow.

All three abilities cost 1 Mana:

- **Ember Charge:** Deal 4 Physical damage. Gain 2 Armor.
- **Furnace Breath:** Deal 2 Burn damage to all enemies.
- **Magma Stomp:** Deal 2 Stun damage to all enemies.

Ability design aims for roughly 6 total value per card across its affected targets, with adjustment for effects such as lasting statuses. This is a design guideline rather than an arithmetic equivalence between damage, Armor and control; it does not retroactively rebalance existing creatures. Single chosen targets are implicit in descriptions; group targets and self-granted effects are explicit. Area attacks resolve living opponents in board order and stop if retaliation knocks out the acting creature. Player area attacks need no chosen target; enemy area attacks affect deployed allies, excluding reserves. Enemy area damage uses one third of encounter attack strength, rounded with a minimum of 1, rather than multiplying full single-target strength across the team.

The selected creature portrait (`04.png`) and three ability portraits are copied unchanged from the user's [Emberback Drive folder](https://drive.google.com/drive/folders/1BAcTaOpKsPQonWJ4mZzJgRE3se0SrGp9) into `public/art/emberback/`. The manifest records each original file URL. Ability-specific artwork is used consistently in battle, inspection and Collection. Ashen Vanish remains outside the playable kit; its Drive source is preserved. PNG selections are copied at their original resolution and aspect ratio without cropping or conversion. Prepared output checks do not establish rendered acceptance.

## Mossguard

Mossguard is a new species ID replacing the removed Mossback content and occupies its former starter and encounter slots. He has 32 Health and three 1 Mana abilities: Boulder Brace grants 6 Block to himself, Rooted Stomp deals 2 Stun damage to every living enemy, and Moss Renewal restores 2 Health to every living deployed ally, including himself. Group healing does not revive knockouts or affect reserves. Upgrades and explicit gameplay modifiers use the existing rules.

Overgrowth retains 10%, 20%, 30%, 40%, 50% or 60% more Block at zero through five stars. This is a relative increase over the ordinary 50% retention: 55%, 60%, 65%, 70%, 75% or 80% of remaining Block survives, rounded normally. It applies on each turn transition, including in reserve. Enemy Mossguard always uses the base tier. Save version 24 rejects obsolete development saves instead of migrating removed species or abilities.

The portrait and three distinct ability illustrations are unchanged PNGs imported from the user-provided [Mossguard Drive folder](https://drive.google.com/drive/folders/1xzid2xsfO4044-xra9i3KU1K1dx_Kxgz). Source provenance is recorded per file in the asset manifest. Removed Mossback placeholders are no longer selected; prior immutable prepared generations are preserved. Source art was inspected at native aspect ratios; in-game rendered review remains a separate gate.
