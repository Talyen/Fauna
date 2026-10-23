# Content and artwork

Author creature stats, six passive tiers and three unique abilities together in `src/game/content/creatures/`. [Creature catalogs](../src/game/content/creatures.ts) retain separate, explicit species/card order; seeded offers consume it. Talent trees live in `src/game/content/talents/`, aggregated by [talents.ts](../src/game/content/talents.ts). Keep shared definition types/builders outside individual kits.

`src/game/content.ts` exposes catalogs, types and lookups. Import descriptions/enemy adaptation from [card-rules.ts](../src/game/card-rules.ts), intrinsic values/costs from [ability-rules.ts](../src/game/ability-rules.ts), and progression calculations from [progression.ts](../src/game/progression.ts). [Content validation](../src/game/content-validation.ts) owns startup/authoring checks separately from save decoding. New effects need exhaustive execution, magnitude and enemy-support decisions through the [gameplay owners](ARCHITECTURE.md#gameplay-owners).

Use [Creature design](CREATURE_DESIGN.md) for artwork-led kits, budgets and Boss/Legendary design. Recommend one coherent kit; offer alternatives when requested or when a consequential choice remains unresolved. [Journey design](EXPEDITION_DESIGN.md) owns recruitment, deployment and rewards; [Architecture](ARCHITECTURE.md#save-contract) owns persistence.

## Ability costs

Every ability, for every creature, has a base cost of exactly **1 Mana**. This applies to all current and future action cards, including attacks, defense, healing and utility. Balance abilities through their damage, protection, status effects and other values rather than varying their authored Mana cost. Card upgrades retain the same base cost. Explicit gameplay modifiers such as talents that make a play free still apply at runtime.

## Ability balance and targeting

Use the [ability budget](CREATURE_DESIGN.md#ability-budgets) as a flexible design guideline, without retroactively rebalancing existing kits. Single chosen targets are implicit in descriptions; group targets and self-granted effects are explicit. Area attacks need no chosen target, resolve living opponents in board order and stop on actor knockout. Enemy targets exclude backup. [Journey rules](EXPEDITION_DESIGN.md#encounters) own room scaling, including extras and mixed Block/Thorns branches.

## Artwork contracts

- **Creature cards: 4:3 landscape, full bleed.** Original production portraits are preserved PNG selections; runtime derivatives use the prepared-media recipe.
- **Location cards: 4:3 landscape.** Original 800 × 600 SVG placeholders in `public/art/locations/`, with names and encounter labels rendered outside the artwork. `scripts/assets/create-location-placeholders.mjs` rewrites only these placeholders.
- **Boon cards: 3:4 portrait, matching hand cards.** Boon displays use dedicated portraits in `public/art/boons/`; keep names and effects outside the artwork.
- **Action cards: 3:4 portrait, full bleed.** Each creature has three dedicated production PNG illustrations.

Use native aspect ratios without stretching or converting one composition into another. Preserve selected originals under `public/art/` or the source library, register them in `assets/manifest.json` and prepare outputs explicitly. Names and rules are UI text; never bake them into art. Branding alone may contain the Fauna wordmark.

[UI contracts](UI.md#layout-artwork-size-and-spacing) own displayed dimensions, contain rendering and overlay exceptions. [Inspection](ui/screens.md#creature-and-action-inspection) owns the current passive, stars and ability disclosure. Source resolution is independent of CSS display size.

## Keyword artwork

`public/art/keywords/` contains unchanged optimized portrait artwork copied from Alchemy for optional keyword illustrations. Talents uses a portrait ArtCard overview that opens dedicated category trees. The original nine selections below are 420 × 563 pixels; additional category portraits and Water’s reused ability artwork are registered in the manifest. Use contain rendering and the [talents overview sizing rule](UI.md#layout-artwork-size-and-spacing).

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

Source directory: `Alchemy: src/assets/optimized/`. Artwork reuse does not import Alchemy's keyword mechanics. The nine original keyword illustrations and additional category selections are registered in `assets/manifest.json`; see [talent category portraits](#talent-category-portraits) and [Water](content/creatures/coralcurl.md).

## Prepared assets

`assets/manifest.json` owns stable media IDs, repository/library-relative source selections, versioned copy/optimization recipes, image aspect ratios, source provenance and rights notes. Art placeholders remain authoring sources under `public/art/`; selected sound recordings and music come from `~/Documents/Asset Library` or `ASSET_LIBRARY_ROOT`. No preparation command modifies or deletes library originals.

```sh
npm run assets:prepare        # Validate sources and publish a complete generation
npm run assets:check          # Verify selected sources, recipes and output hashes
npm run assets:check:outputs  # Validate committed outputs without the source library
```

Preparation reads and validates all selected sources before publication. Each immutable object lives under `public/prepared/objects/<fingerprint>/`; its fingerprint includes source bytes, recipe settings, output format and the encoder toolchain. Each object has a hash receipt; unchanged objects are reused without rewriting or re-encoding. `src/assets/prepared.json` is the complete generated lookup and publication receipt. The pointer changes atomically only after every selected output passes validation. Missing sources, corrupt objects and encoding failures preserve the prior pointer. Preparation never modifies or deletes original artwork, library files or historical generations. Generated files are not edited by hand. Explicit repository cleanup may retire unreferenced tracked outputs after validating the active lookup and checking all repository references; Git history retains those outputs. Original source artwork and active objects remain preserved.

The main menu logo selection uses `Fauna_Gamboloom_Logo.png` from Google Drive, preserved in `public/art/branding/` and registered as `logo.main-menu`. Its lossless WebP derivative retains transparency and the complete composition. Branding includes the Fauna wordmark; gameplay artwork keeps the text-free rule above. The menu retains its accessible Fauna heading and uses the shared artwork sizing profiles.

### Artwork resolution and quality

The `card-webp` recipe uses lossless WebP and fits PNG artwork within a 960 × 960 pixel box without cropping, stretching or enlargement. This supports a long edge of 480 CSS pixels at 2× device pixel ratio, with headroom over current standard/battle cards, hovered cards, Collection abilities and inspection. Resolution is based on displayed CSS size multiplied by device pixel ratio, not a file's print DPI; see [responsive image sizing](https://web.dev/articles/responsive-images). The central recipe contract lives in [art recipes](../scripts/assets/art-recipes.mjs); changing it invalidates prepared selections and cache keys. Source images smaller than the target retain their native resolution; enlargement cannot restore absent detail. Existing optimized WebP files and scalable SVG artwork use byte-preserving copy recipes. The talents overview has viewport-dependent sizing and retains its existing native WebP sources; preparation does not claim those smaller source files provide 2× detail at arbitrary viewport sizes.

Lossless encoding preserves the resized image's pixels, including alpha, without lossy compression artifacts. Downsampling still changes pixels, so visual review remains required. Raster validation fully decodes sources and outputs, rejects animated/oriented artwork and verifies geometry and hashes. Receipts record source/output byte counts and prepared dimensions.

```sh
npm run assets:review        # Generate original/prepared comparisons and a contact sheet
npm run assets:check:bundle  # Verify an existing build's exact active media inventory and budgets
```

Artwork review writes `reports/art-review/index.html`, a contact sheet of optimized selections and a size summary. Inspect the comparison at 2× display density and use CI's actual hand, creature, Collection and inspection evidence for visual acceptance. This review does not establish in-game rendering quality or physical-device acceptance.

Runtime artwork/audio resolves stable IDs through the generated lookup. Ordinary development and production builds run output-only checks; they never regenerate media or need access to the library. The build disables automatic public-directory copying and emits only the active lookup's files plus its build receipt. Authoring originals, cache receipts and old generations stay out of the shipped renderer. Build validation rejects extra/missing media, changed bytes and unapproved public resources, with a 128 MiB total-media limit and 3 MiB limit per image. JavaScript retains its separate measured budget. Historical outputs can remain available locally without increasing each new build; cleanup is separate and explicit. The object layout reuses unchanged assets across selections.

Source checks are required after media authoring. Output-only checks verify the recipe contract without requiring the preparing machine's exact native encoder versions; source checks additionally verify selected source bytes. Hash/geometry/decode checks do not establish visual suitability, source-license clearance or listening acceptance. Retain upstream source-license metadata; the manifest records the shared-library selection and provenance, not a new license grant.

Recorded sounds cover typed combat outcomes, healing, defense, rejected actions, knockouts, recruitment, talents and battle outcomes. Menu, combat and boss tracks are selected independently of Alchemy's routes. Runtime volume uses Master × Music or Master × Sound effects, with background mute and a convenient Sound toggle. Preferences are independent of saves. Audio follows committed commands, respects quiet previews, and never controls gameplay, saves or command admission. Current selections still require Fauna listening/mix review. See [Sound desk](DEVELOPMENT_TOOLS.md#prepared-media-and-sound-desk).

## Boon selections

All 18 Boons use the corresponding portrait WebP files copied from `Alchemy: src/assets/optimized/` into `public/art/boons/`. The manifest records each source, provenance and output hash. Prepared assets are Fauna-owned copies with no sibling runtime dependency. Boon IDs and displayed rules are authored in `src/game/content/boons.ts`; combat effects are executed in `src/game/combat/`; intermediate-boss cadence is unchanged.

The 18 Boons share the same unowned reward and Merchant pools. Meteorite doubles the first allied direct Burn hit each battle, including supplemental Burn; a Dodge does not consume it. Its battle-wide receipt survives saves and swaps and resets only at the next battle. Sin-Eater's Lantern restores 6 Health per harmful effect actually removed by Cleanse and combines with Renewal. Thunderstone deals one derived 6 Nature damage packet when an allied hit successfully Stuns an enemy; it does not reapply statuses or retaliate. Grove's Favor grants the healed creature 1 Thorns per actual allied healing packet in battle; full-Health attempts and Campfire recovery grant none. Prepared portraits still require rendered review.

The remaining compatible Alchemy Boons are Brass Censer, Parasitic Bloom, Cutpurse Knife, Merchant's Favor, Plague Doctor's Mask, Sundering Charm, Resonant Chimes, Smuggler's Map, Frozen Pocketwatch and Lucky Clover. Light replaces Alchemy's Holy wording. Forge, Wish, Potion and Companion Boons remain excluded because Fauna has no matching mechanics. Consume exists on Pearls, but Consume-dependent Boons and talents remain excluded from this catalog.

Brass Censer gives allied Light hits a 20% chance to either deal their damage again as Burn or Leech, with an equal split. Parasitic Bloom gives allied Poison hits and attributed ticks a 10% chance to Leech. Cutpurse Knife grants 1 Gold per allied Bleed hit or attributed tick that removes Health. Lucky Clover gives allied Nature hits a 10% chance to grant Gold equal to Health lost. These effects use seeded combat randomness and existing capped earnings and healing owners; derived damage cannot recursively trigger Brass Censer or Lucky Clover.

Sundering Charm removes 2 enemy Armor before Physical or Stun hit mitigation, after Dodge. Frozen Pocketwatch extends enemy Freeze to two skipped turns, followed by the existing shared immunity. Before allied turn-start damage, Plague Doctor's Mask removes up to 2 Poison from each living creature, including backup, and deals half the removed amount (rounded normally) as Poison to the first living enemy. Fully removing Poison triggers Cleanse rewards; partial stack removal does not.

Resonant Chimes refunds 1 shared Mana after the third accepted card of each turn, before automatic end turn. Repeated card effects count once. Its capped battle-wide counter survives previews, swaps and resume and resets each turn and battle. Merchant’s Favor reduces each new stock slot’s rolled price by 7 Gold, from 20–40 to 13–33 inclusive when stock is prepared; the one-purchase visit limit still applies. Smuggler's Map adds 2 Gold to victory rewards, including bosses, using ordinary settlement and retained-earnings limits.

## Support encounter content

Boon Merchant prices, affordability and Campfire eligibility/recovery are owned by `src/game/destinations.ts`. Stock selects up to three unowned Boons from the existing catalog and persists with each visit; purchase receipts also persist through the Boon reward screen. Boon Merchant currently reuses the prepared Silken Clearing location illustration, an explicit existing placeholder rather than a newly approved source-library selection. Boon portraits retain their existing asset manifests and receipts. Replace location selections through the prepared-asset workflow when final art is selected.

## Encounter placeholders

`public/art/encounters/` preserves original blank Combat and Boss landscape SVGs, registered as `encounter.combat` and `encounter.boss`. Location assets remain available for support art. Boss screens currently use species artwork; [screen specifications](ui/screens.md#encounter-and-required-replacement) own composition.

Combat music uses `music.fernwood`; that historical source ID does not imply biomes or select progression. [Journey design](EXPEDITION_DESIGN.md#encounters) owns encounter packs and boss cadence.

## Creature passive tiers

Each species in `src/game/content.ts` owns six `passiveTiers`, indexed by stars from zero through five. The first recruitment collects the species at zero stars; the sixth reaches five. Counts persist across journeys and cap at six. Committing the first onboarding starter supplies one initial copy. Later starter drafts and encounter discovery do not grant copies.

Every species must define all six tiers, and each tier must have different gameplay effects from every other tier. Scaling effect amounts or chances is the usual approach; new mechanics can also distinguish tiers. Changed wording, object property order or effect order alone does not count. The type contract requires six defined entries, and catalog validation rejects missing or duplicate effect sets. A tier replaces the whole previous passive rather than adding to it; include all retained effects in its effect list. Tiers can compose card bonuses, opening defenses and recurring effects. Favor species-exclusive mechanics independent of named abilities. New mechanics belong in the typed passive effect contract and its gameplay consumers alongside matching descriptions and regression coverage. Player rules, previews and inspection use the tier at the permanent rank. Enemies always use the base tier. Inspection shows only the active tier and current progress stars, following the [inspection contract](ui/screens.md#creature-and-action-inspection).

## Battle pile artwork

`public/art/battle/draw-pile.webp`, `discard-pile.webp` and `card-back.webp` are unchanged 420×560 optimized artwork copied from `Alchemy: src/assets/optimized/`, with reuse explicitly requested by the user. The prepared manifest owns `pile.draw`, `pile.discard` and `card.back`; runtime has no sibling-project dependency. Draw and discard ArtCards preserve the 3:4 aspect ratio. Flying discards use the same top-card crop and landing bounds as Alchemy: x=25/420, y=25/560, width=328/420, height=432/560. The source library and original placeholders remain preserved; earlier prepared outputs remain recoverable from Git history.

## Talent category portraits

Armor, Bleed, Dodge, Leech and Mana now use their distinct existing Alchemy portraits, copied unchanged from `Alchemy: src/assets/optimized/talent-<keyword>.webp` into `public/art/keywords/`. These follow the existing Alchemy keyword-art reuse, with source provenance in `assets/manifest.json` and Fauna-owned prepared outputs. There is no runtime dependency on Alchemy.

## Creature references

The [creature index](content/creatures/README.md) links kits, distinctive edge rules and artwork rationale. The manifest owns per-file provenance/rights; dated rendered observations remain historical evidence. Shared authoring and preparation rules belong here.

Memento uses the four original selections from its user-provided Drive folder, plus generated Echo (4:3) and Pearl (3:4) artwork based on those selections. Originals are retained in `public/art/memento/`; the asset manifest records provenance and prepared WebP derivatives. See [Memento](content/creatures/memento.md) and its [generation prompts](content/creatures/memento-art-prompts.md).
