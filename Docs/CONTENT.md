# Content and artwork

`src/game/encounters.ts` owns encounter progression, enemy packs, and explicit room power. `src/game/combat/abilities.ts` executes abilities for players, previews and enemies inside the command transaction. `src/game/combat/ability-values.ts` shares magnitude scaling between execution and descriptions. New primary effects and extras require exhaustive execution, magnitude and enemy-support decisions; keep hand, Mana, XP and settlement in the command engine. `src/game/content/` owns authored species, cards, talents, Boons and stable encounter templates. `src/game/content.ts` exposes roster/card lookups; `src/game/card-rules.ts` owns displayed effect descriptions and exhaustive enemy adaptation. Import description and adaptation rules directly from that owner rather than through the catalog entrypoint. [Content validation](../src/game/content-validation.ts) owns startup and authoring checks independently of save decoding. Catalog order remains intentional. Each species contributes exactly three unique card definitions. Content validation runs at startup and in tests. Keep authored IDs and their consumers consistent; obsolete development formats are rejected under the [save contract](ARCHITECTURE.md#save-contract).

Author each creature's stats, six passive tiers and three abilities together in `src/game/content/creatures/`; the [creature reference index](content/creatures/README.md) links each kit and its design notes. [Creature catalogs](../src/game/content/creatures.ts) retain explicit, separate species and card order because seeded offers and selections consume them. Author talent trees by keyword in `src/game/content/talents/`; [the talent catalog](../src/game/content/talents.ts) retains their existing combined order. Shared definition types and card builders remain outside individual kits. There is no elemental chart. Consumers access catalogs through `src/game/content.ts`; progression calculations belong to `src/game/progression.ts`.

Use [Creature design](CREATURE_DESIGN.md) and the [creature design skill](../.agents/skills/fauna-creature-design/SKILL.md) when proposing or implementing a new kit: inspect its artwork, compare current mechanics, present passive and ability alternatives, budget the complete kit and validate its player/enemy behavior. The workflow includes [Boss and Legendary design](CREATURE_DESIGN.md#boss-and-legendary-creatures) grounded in Memento.

[Journey progression](EXPEDITION_DESIGN.md) owns roster limits, starter eligibility, recruitment, swaps, Campfire recovery and reward flow. [Architecture](ARCHITECTURE.md#save-contract) owns the current save contract and disposable development-save policy.

## Ability costs

Every ability, for every creature, has a base cost of exactly **1 Mana**. This applies to all current and future action cards, including attacks, defense, healing and utility. Balance abilities through their damage, protection, status effects and other values rather than varying their authored Mana cost. Card upgrades retain the same base cost. Explicit gameplay modifiers such as talents that make a play free still apply at runtime.

## Ability balance and targeting

Ability design aims for roughly 6 total value per card across its affected targets, with adjustment for effects such as lasting statuses. This is a design guideline rather than an arithmetic equivalence between damage, Armor and control; it does not retroactively rebalance existing creatures. Single chosen targets are implicit in descriptions; group targets and self-granted effects are explicit. Area attacks resolve living opponents in board order and stop if retaliation knocks out the acting creature. Player area attacks need no chosen target; enemy area attacks affect deployed allies, excluding backup. Both sides use the same authored area damage. Enemy ability damage, healing and Block gain 10% of their authored base per room after the first, rounded normally; all other amounts retain their authored rules. Mixed Block-or-Thorns abilities scale Block only. This room modifier also applies to supplemental damage and healing, without scaling chances, effect counts or resources.

## Artwork contracts

- **Creature cards: 4:3 landscape, full bleed.** Original production portraits are preserved PNG selections; runtime derivatives use the prepared-media recipe.
- **Location cards: 4:3 landscape.** Original 800 × 600 SVG placeholders in `public/art/locations/`, with names and encounter labels rendered outside the artwork. `scripts/assets/create-location-placeholders.mjs` rewrites only these placeholders.
- **Boon cards: 3:4 portrait, matching hand cards.** Boon displays use dedicated portraits in `public/art/boons/`; keep names and effects outside the artwork.
- **Action cards: 3:4 portrait, full bleed.** Each creature has three dedicated production PNG illustrations.

Displayed artwork uses equal-area preferred dimensions of 200×266⅔ portrait and 266⅔×200 landscape in CSS pixels, with shared 90% and 80% profiles at compact heights. Battle fits both creature rows to the available space and uses the active portrait profile for hand cards. Reflow and pagination keep every surface reachable without scrolling or shrinking selected text and control hit areas. The talents overview has its own sizing rule; source asset resolution is independent of displayed size. See [layout rules](UI.md#layout-artwork-size-and-spacing).

These are separate compositions, not crops of one format into another. Replace the selected sources in `public/art/` or the shared library, update `assets/manifest.json` where needed, and explicitly prepare the new generation. Images use their native aspect ratio with no stretching. All text is rendered by the UI, not baked into artwork. Artwork contains no text or UI overlays except the thin health bars inside battlefield creature frames. Creature inspection shows artwork beside the active named trait and three action thumbnails; Rank progression opens a separate paginated view in the same dialog. Selecting a thumbnail pins action artwork with hover/focus rules; keyboard/controller cycling has no Previous/Next buttons. Battle uses hover/focus details without pinned inspection. Collection creature pages show the trait and all three base abilities with readable names, Mana costs and rules outside artwork. See [inspection and Collection rules](UI.md#other-screens).

The retired creature placeholders and their authoring script have been removed; earlier prepared outputs remain recoverable from Git history. Mana UI sprites were adapted from Alchemy; no species illustrations or fonts were copied from Alchemy. Keyword artwork reuse is documented below.

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

## Composition

The enemy row is above the player row, and the portrait hand is at the bottom. Enemy intents remain hidden. Thin battlefield health bars sit inside the bottom artwork edge; Block, status icons, acting outlines and targeting feedback remain outside. Defeated creatures remain visible but subdued. Important actions have visible outcomes, independent of sound. Outcome-driven floating numbers, recoil and optional recorded sound present committed actions.

Review the draft, encounters, three-enemy battle, reward choices, inspection and results at every [required viewport and input setting](UI.md#required-review). Automatic geometry assertions supplement visual inspection; they do not establish physical handheld readability or performance.

## Prepared assets

`assets/manifest.json` owns stable media IDs, repository/library-relative source selections, versioned copy/optimization recipes, image aspect ratios, source provenance and rights notes. Art placeholders remain authoring sources under `public/art/`; selected sound recordings and music come from `~/Documents/Asset Library` or `ASSET_LIBRARY_ROOT`. No preparation command modifies or deletes library originals.

```sh
npm run assets:prepare        # Validate sources and publish a complete generation
npm run assets:check          # Verify selected sources, recipes and output hashes
npm run assets:check:outputs  # Validate committed outputs without the source library
```

Preparation reads and validates all selected sources before publication. Each immutable object lives under `public/prepared/objects/<fingerprint>/`; its fingerprint includes source bytes, recipe settings, output format and the encoder toolchain. Each object has a hash receipt; unchanged objects are reused without rewriting or re-encoding. `src/assets/prepared.json` is the complete generated lookup and publication receipt. The pointer changes atomically only after every selected output passes validation. Missing sources, corrupt objects and encoding failures preserve the prior pointer. Preparation never modifies or deletes original artwork, library files or historical generations. Generated files are not edited by hand. Explicit repository cleanup may retire unreferenced tracked outputs after validating the active lookup and checking all repository references; Git history retains those outputs. Original source artwork and active objects remain preserved.

The temporary main menu logo uses `Fauna_Gamboloom_Logo.png` from Google Drive, preserved in `public/art/branding/` and registered as `logo.main-menu`. Its lossless WebP derivative retains transparency and the complete composition. Branding includes the Fauna wordmark; gameplay artwork keeps the text-free rule above. The menu retains its accessible Fauna heading and uses the shared artwork sizing profiles.

### Artwork resolution and quality

The `card-webp` recipe uses lossless WebP and fits PNG artwork within a 960 × 960 pixel box without cropping, stretching or enlargement. This supports a long edge of 480 CSS pixels at 2× device pixel ratio, with headroom over current standard/battle cards, hovered cards, Collection abilities and inspection. Resolution is based on displayed CSS size multiplied by device pixel ratio, not a file's print DPI; see [responsive image sizing](https://web.dev/articles/responsive-images). The central recipe contract lives in [art recipes](../scripts/assets/art-recipes.mjs); changing it invalidates prepared selections and cache keys. Source images smaller than the target retain their native resolution; enlargement cannot restore absent detail. Existing optimized WebP files and scalable SVG artwork use byte-preserving copy recipes. The talents overview has viewport-dependent sizing and retains its existing native WebP sources; preparation does not claim those smaller source files provide 2× detail at arbitrary viewport sizes.

Lossless encoding preserves the resized image's pixels, including alpha, without lossy compression artifacts. Downsampling still changes pixels, so visual review remains required. Raster validation fully decodes sources and outputs, rejects animated/oriented artwork and verifies geometry and hashes. Receipts record source/output byte counts and prepared dimensions.

```sh
npm run assets:review        # Generate original/prepared comparisons and a contact sheet
npm run assets:check:bundle  # Verify an existing build's exact active media inventory and budgets
```

Artwork review writes `reports/art-review/index.html`, a contact sheet of optimized selections and a size summary. Inspect the comparison at 2× display density and use CI's actual hand, creature, Collection and inspection evidence for visual acceptance. This review does not establish in-game rendering quality or physical-device acceptance.

Runtime artwork/audio resolves stable IDs through the generated lookup. Ordinary development and production builds run output-only checks; they never regenerate media or need access to the library. The build disables automatic public-directory copying and emits only the active lookup's files plus its build receipt. Authoring originals, cache receipts and old generations stay out of the shipped renderer. Build validation rejects extra/missing media, changed bytes and unapproved public resources, with a 128 MiB total-media limit and 3 MiB limit per image. JavaScript retains its separate measured budget. Historical outputs can remain available locally without increasing each new build; cleanup is separate and explicit. The obsolete whole-generation directories under `public/prepared/<fingerprint>/` have been retired; the current object layout avoids duplicating every unchanged asset for each selection change.

Source checks are required after media authoring. Output-only checks verify the recipe contract without requiring the preparing machine's exact native encoder versions; source checks additionally verify selected source bytes. Hash/geometry/decode checks do not establish visual suitability, source-license clearance or listening acceptance. Retain upstream source-license metadata; the manifest records the shared-library selection and provenance, not a new license grant.

Recorded sounds cover typed combat outcomes, healing, defense, rejected actions, knockouts, recruitment, talents and battle outcomes. Menu, combat and boss tracks are selected independently of Alchemy's routes. Runtime volume uses Master × Music or Master × Sound effects, with background mute and a convenient Sound toggle. Preferences are independent of saves. Audio follows committed commands, respects quiet previews, and never controls gameplay, saves or command admission. Current selections still require Fauna listening/mix review. See [Sound desk](DEVELOPMENT_TOOLS.md#prepared-media-and-sound-desk).

## Boon selections

All 18 Boons use the corresponding portrait WebP files copied from `Alchemy: src/assets/optimized/` into `public/art/boons/`. The manifest records each source, provenance and output hash. Prepared assets are Fauna-owned copies with no sibling runtime dependency. Boon IDs and displayed rules are authored in `src/game/content/boons.ts`; combat effects are executed in `src/game/combat/`; intermediate-boss cadence is unchanged.

The 18 Boons share the same unowned reward and Merchant pools. Meteorite doubles the first allied direct Burn hit each battle, including supplemental Burn; a Dodge does not consume it. Its battle-wide receipt survives saves and swaps and resets only at the next battle. Sin-Eater's Lantern restores 6 Health per harmful effect actually removed by Cleanse and combines with Renewal. Thunderstone deals one derived 6 Nature damage packet when an allied hit successfully Stuns an enemy; it does not reapply statuses or retaliate. Grove's Favor grants the healed creature 1 Thorns per actual allied healing packet in battle; full-Health attempts and Campfire recovery grant none. Prepared portraits still require rendered review.

The remaining compatible Alchemy Boons are Brass Censer, Parasitic Bloom, Cutpurse Knife, Merchant's Favor, Plague Doctor's Mask, Sundering Charm, Resonant Chimes, Smuggler's Map, Frozen Pocketwatch and Lucky Clover. Light replaces Alchemy's Holy wording. Forge, Consume, Wish, Potion and Companion Boons remain excluded because Fauna has no matching mechanics.

Brass Censer gives allied Light hits a 20% chance to either deal their damage again as Burn or Leech, with an equal split. Parasitic Bloom gives allied Poison hits and attributed ticks a 10% chance to Leech. Cutpurse Knife grants 1 Gold per allied Bleed hit or attributed tick that removes Health. Lucky Clover gives allied Nature hits a 10% chance to grant Gold equal to Health lost. These effects use seeded combat randomness and existing capped earnings and healing owners; derived damage cannot recursively trigger Brass Censer or Lucky Clover.

Sundering Charm removes 2 enemy Armor before Physical or Stun hit mitigation, after Dodge. Frozen Pocketwatch extends enemy Freeze to two skipped turns, followed by the existing shared immunity. Before allied turn-start damage, Plague Doctor's Mask removes up to 2 Poison from each living creature, including backup, and deals half the removed amount (rounded normally) as Poison to the first living enemy. Fully removing Poison triggers Cleanse rewards; partial stack removal does not.

Resonant Chimes refunds 1 shared Mana after the third accepted card of each turn, before automatic end turn. Repeated card effects count once. Its capped battle-wide counter survives previews, swaps and resume and resets each turn and battle. Merchant's Favor commits a 13 Gold price instead of 20 when each new Merchant stock is prepared; the one-purchase visit limit still applies. Smuggler's Map adds 2 Gold to victory rewards, including bosses, using ordinary settlement and retained-earnings limits.

## Support encounter content

Boon Merchant prices, affordability and Campfire eligibility/recovery are owned by `src/game/destinations.ts`. Stock selects up to three unowned Boons from the existing catalog and persists with each visit; purchase receipts also persist through the Boon reward screen. Boon Merchant currently reuses the prepared Silken Clearing location illustration, an explicit existing placeholder rather than a newly approved source-library selection. Boon portraits retain their existing asset manifests and receipts. Replace location selections through the prepared-asset workflow when final art is selected.

## Encounter placeholders

Ordinary Combat uses an original blank 4:3 SVG placeholder; the preserved Boss placeholder is retained in the manifest. Both original files remain in `public/art/encounters/`, registered as `encounter.combat` and `encounter.boss`. Labels remain outside the artwork. Enemy packs and encounter progression live in `src/game/encounters.ts`; named destination selection is removed. The existing location assets remain available for support artwork.

Journeys use one shared combat enemy pool, with bosses at encounters 4 and 8. There are no biome divisions. Combat music reuses the prepared track registered as `music.fernwood`; that source ID does not select progression. Boss entrances show their authored name and species artwork with base-trait hover/focus details. Ordinary encounters retain the blank Combat entrance. Activating either starts the saved battle directly, without revealing turn intents or opening a preview dialog.

## Creature passive tiers

Each species in `src/game/content.ts` owns six `passiveTiers`, indexed by stars from zero through five. The first recruitment collects the species at zero stars; the sixth reaches five. Counts persist across journeys and cap at six. Committing the first onboarding starter supplies one initial copy. Later starter drafts and encounter discovery do not grant copies.

Every species must define all six tiers, and each tier must have different gameplay effects from every other tier. Scaling effect amounts or chances is the usual approach; new mechanics can also distinguish tiers. Changed wording, object property order or effect order alone does not count. The type contract requires six defined entries, and catalog validation rejects missing or duplicate effect sets. A tier replaces the whole previous passive rather than adding to it; include all retained effects in its effect list. Tiers can compose card bonuses, opening defenses and recurring effects. Favor species-exclusive mechanics independent of named abilities. New mechanics belong in the typed passive effect contract and its gameplay consumers alongside matching descriptions and regression coverage. Player rules, previews and inspection use the tier at the permanent rank. Enemies always use the base tier. Inspection shows all six complete tiers, the current rank and the active effect.

Existing complete Overgrowth, Molten Shell, Cross-Pollination and Refraction progressions retain their authored effects. Sporecoat retaliates for 1 through 6 Poison damage.

## Battle pile artwork

`public/art/battle/draw-pile.webp`, `discard-pile.webp` and `card-back.webp` are unchanged 420×560 optimized artwork copied from `Alchemy: src/assets/optimized/`, with reuse explicitly requested by the user. The prepared manifest owns `pile.draw`, `pile.discard` and `card.back`; runtime has no sibling-project dependency. Draw and discard ArtCards preserve the 3:4 aspect ratio. Flying discards use the same top-card crop and landing bounds as Alchemy: x=25/420, y=25/560, width=328/420, height=432/560. The source library and original placeholders remain preserved; earlier prepared outputs remain recoverable from Git history.

## Talent category portraits

Armor, Bleed, Dodge, Leech and Mana now use their distinct existing Alchemy portraits, copied unchanged from `Alchemy: src/assets/optimized/talent-<keyword>.webp` into `public/art/keywords/`. These follow the existing Alchemy keyword-art reuse, with source provenance in `assets/manifest.json` and Fauna-owned prepared outputs. There is no runtime dependency on Alchemy.

## Creature references

The [creature index](content/creatures/README.md) links each complete kit and passive reference. Artwork provenance and implementation-time validation notes are kept in a separate section of each reference; source and prepared-asset contracts remain here

Memento uses the four original selections from its user-provided Drive folder, plus generated Echo (4:3) and Pearl (3:4) artwork based on those selections. Originals are retained in `public/art/memento/`; the asset manifest records provenance and prepared WebP derivatives. See [Memento](content/creatures/memento.md) and its [generation prompts](content/creatures/memento-art-prompts.md).
