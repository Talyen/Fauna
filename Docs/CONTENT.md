# Content and artwork

Author creature stats, six passive tiers and three unique abilities together in `src/game/content/creatures/`. [Creature catalogs](../src/game/content/creatures.ts) retain separate, explicit species/card order; seeded offers consume it. Talent trees live in `src/game/content/talents/`, aggregated by [talents.ts](../src/game/content/talents.ts). Keep shared definition types/builders outside individual kits.

`src/game/content.ts` exposes catalogs, types and lookups. Import descriptions/enemy adaptation from [card-rules.ts](../src/game/card-rules.ts), intrinsic values/costs from [ability-rules.ts](../src/game/ability-rules.ts), and progression calculations from [progression.ts](../src/game/progression.ts). [Content validation](../src/game/content-validation.ts) owns startup/authoring checks separately from save decoding. New effects need exhaustive execution, magnitude and enemy-support decisions through the [gameplay owners](ARCHITECTURE.md#gameplay-owners).

Use [Creature design](CREATURE_DESIGN.md) for artwork-led kits, budgets and Boss/Legendary design. Recommend one coherent kit; offer alternatives when requested or when a consequential choice remains unresolved. [Journey design](EXPEDITION_DESIGN.md) owns recruitment, deployment and rewards; [Architecture](ARCHITECTURE.md#save-contract) owns persistence.

## Ability costs

All authored abilities cost exactly **1 Mana**, including generated cards and upgrades. Balance their effects and values instead of their cost. Explicit gameplay modifiers may make a play free.

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

The [manifest](../assets/manifest.json) identifies keyword/category portraits, copy recipes and later Alchemy source selections. The [original nine-source mapping](archive/ALCHEMY_ADOPTION_PLAN.md#keyword-source-selections) retains provenance referenced by older manifest entries. These unchanged Alchemy portraits are Fauna-owned copies, independent of Alchemy's mechanics or runtime. Water reuses [Coralcurl's Reef Jet](content/creatures/coralcurl.md). Use contain rendering and the [talents overview sizing rule](ui/screens.md#talents).

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

Artwork review writes `reports/art-review/index.html`, a contact sheet of optimized selections and a size summary. Inspect comparisons at 2× display density, then follow [UI review](UI.md#required-review) for current hand, creature, Collection and inspection evidence. This review does not establish in-game rendering quality or physical-device acceptance.

Runtime artwork/audio resolves stable IDs through the generated lookup. Ordinary development and production builds run output-only checks; they never regenerate media or need access to the library. The build disables automatic public-directory copying and emits only the active lookup's files plus its build receipt. Authoring originals, cache receipts and old generations stay out of the shipped renderer. Build validation rejects extra/missing media, changed bytes and unapproved public resources, with a 128 MiB total-media limit and 3 MiB limit per image. JavaScript retains its separate measured budget. Historical outputs can remain available locally without increasing each new build; cleanup is separate and explicit. The object layout reuses unchanged assets across selections.

Source checks are required after media authoring. Output-only checks verify the recipe contract without requiring the preparing machine's exact native encoder versions; source checks additionally verify selected source bytes. Hash/geometry/decode checks do not establish visual suitability, source-license clearance or listening acceptance. Retain upstream source-license metadata; the manifest records the shared-library selection and provenance, not a new license grant.

Recorded sounds cover typed combat outcomes, healing, defense, rejected actions, knockouts, recruitment, talents and battle outcomes. Menu, combat and boss tracks are selected independently of Alchemy's routes. Runtime volume uses Master × Music or Master × Sound effects, with background mute and a convenient Sound toggle. Preferences are independent of saves. Audio follows committed commands, respects quiet previews, and never controls gameplay, saves or command admission. Current selections still require Fauna listening/mix review. See [Sound desk](DEVELOPMENT_TOOLS.md#prepared-media-and-sound-desk).

## Boon selections

[boons.ts](../src/game/content/boons.ts) owns available Boons, IDs and displayed rules; [combat execution](../src/game/combat/) and its [Boon regressions](../tests/unit/game/boons.test.ts) define timing, caps, actual-outcome triggers and recursion limits. Use those owners for exact values rather than maintaining a second catalog here.

Portraits are unchanged WebP selections copied from `Alchemy: src/assets/optimized/`; the manifest records per-file sources, rights and hashes. Light replaces Alchemy's Holy terminology. Forge, Wish, Potion and Companion Boons are excluded because Fauna lacks their mechanics; Consume-dependent Boons and talents are excluded despite Pearls using Consume.

[Journey rules](EXPEDITION_DESIGN.md#currency-and-items) own reward pools and journey-only ownership; [Merchant rules](EXPEDITION_DESIGN.md#optional-support-visits) own stock and prices. Inspect new portraits through the UI review procedure.

## Support encounter content

[destinations.ts](../src/game/destinations.ts) owns support eligibility, saved stock, prices and receipts under the [journey rules](EXPEDITION_DESIGN.md#optional-support-visits). Merchant art uses Silken Clearing as a placeholder; replace it through the prepared-asset workflow when final art is selected.

## Encounter placeholders

`public/art/encounters/` preserves blank landscape SVGs registered as `encounter.combat` and `encounter.boss`; location assets remain available for support art. [Encounter presentation](ui/screens.md#encounter-and-required-replacement) uses blank Combat art and species art for Bosses. The music ID `music.fernwood` identifies a recording, not a biome or progression rule.

## Creature passive tiers

Each species defines six complete `passiveTiers`, indexed by zero through five stars. Every tier must differ in gameplay effects from every other tier: amounts, chances or mechanics may change; wording, property order and effect order alone do not qualify. Each tier replaces the entire previous passive, so retain all intended effects explicitly. Types require six entries and catalog validation rejects duplicate effect sets.

Favor species-exclusive mechanics independent of named abilities. Add new mechanics to the typed passive contract, execution, descriptions and focused regressions together. Player rules and previews use permanent rank; enemies use the base tier. [Journey progression](EXPEDITION_DESIGN.md#collection-and-passive-ranks) owns copy counts and ranks; [inspection](ui/screens.md#creature-and-action-inspection) owns disclosure.

## Battle pile artwork

The user authorized unchanged 420×560 Alchemy copies for `pile.draw`, `pile.discard` and `card.back`. The manifest records their sources under `public/art/battle/`; preserve source-library originals and placeholders; earlier prepared outputs remain recoverable from Git. Flying discards match the source top-card bounds: x=25/420, y=25/560, width=328/420, height=432/560. Display keeps the 3:4 ratio.

## Creature references

The [creature index](content/creatures/README.md) links kits, distinctive edge rules and artwork rationale. The manifest owns per-file provenance/rights; dated rendered observations remain historical evidence. Shared authoring and preparation rules belong here.

[Memento](content/creatures/memento.md) records its four original selections and proposed Echo/Pearl artwork; [generation prompts](content/creatures/memento-art-prompts.md) retain the references and intent.
