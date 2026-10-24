# Content and artwork

Author creature stats, six passive tiers and three unique abilities together in `src/game/content/creatures/`. [Creature catalogs](../src/game/content/creatures.ts) retain separate, explicit species/card order; seeded offers consume it. Talent trees live in `src/game/content/talents/`, aggregated by [talents.ts](../src/game/content/talents.ts). Keep shared definition types/builders outside individual kits.

`src/game/content.ts` exposes catalogs, types and lookups. Import descriptions/enemy adaptation from [card-rules.ts](../src/game/card-rules.ts), intrinsic values/costs from [ability-rules.ts](../src/game/ability-rules.ts), and progression calculations from [progression.ts](../src/game/progression.ts). [Content validation](../src/game/content-validation.ts) owns startup/authoring checks separately from save decoding. New effects must complete the [ability rule and execution contracts](ARCHITECTURE.md#ability-rules).

Use [Creature design](CREATURE_DESIGN.md) for artwork-led kits, budgets and Boss/Legendary design. Recommend one coherent kit; offer alternatives when requested or when a consequential choice remains unresolved. [Journey design](EXPEDITION_DESIGN.md) owns recruitment, deployment and rewards; [Architecture](ARCHITECTURE.md#save-contract) owns persistence.

## Adding ability mechanics

Reuse an existing kind when its behavior already fits. A new primary kind belongs in [ability-types.ts](../src/game/rules/ability-types.ts), its complete policy in the appropriate [rule family](../src/game/rules/), and its mutation handler in [ability-handlers.ts](../src/game/combat/ability-handlers.ts). The compiler requires targeting, scaling, enemy support/adaptation, keywords, description and execution decisions. Keep authored cards data-only; presentation consumes card queries instead of handlers.

Supplemental effects have their own complete [rule catalog](../src/game/rules/supplemental.ts) and [execution catalog](../src/game/combat/ability-extras.ts). Declare whether they follow the primary recipient or the global delivery window, and whether reflection returns them or leaves them with the actor. Keep authored order. Update the application's explicit benefit assessment when a new mechanic affects Auto-play; gameplay owns reusable visible facts, while application owns priorities and deliberate approximations.

Add focused player-behavior regressions for new mechanics. Refactors must preserve the pre-extraction [ability baselines](../tests/unit/game/ability-contracts.test.ts), ordered events and RNG consumption; do not regenerate expectations merely to accept changed results.

## Adding gameplay modifiers

Add a Talent, Boon or passive kind together with its named implementation binding in [modifier-bindings.ts](../src/game/modifier-bindings.ts). Bind the functions that actually select and implement it at the existing execution stages. Declare all implementation sites when a rule participates in several stages, and keep gameplay query interpretations in `modifierQueries`. The [ownership contract](ARCHITECTURE.md#modifier-ownership) checks completeness, actual selectors and runtime connections; a new definition alone cannot establish implementation support.

Keep effect order explicit in the owning coordinator. Adding or reordering catalog entries must not establish reaction order. Preserve live side/deployment checks and actor-liveness checks between child reactions. Add a focused regression for observable behavior; preserve the recorded [modifier baseline](../tests/unit/game/modifier-contracts.test.ts) during refactors. Intentional mechanic changes require reviewed expectations. Every passive tier remains independently authored and complete.

## Ability costs

All authored abilities cost exactly **1 Mana**, including generated cards and upgrades. Balance their effects and values instead of their cost. Explicit gameplay modifiers may make a play free.

## Ability balance and targeting

Use the [ability budget](CREATURE_DESIGN.md#ability-budgets) as a flexible design guideline, without retroactively rebalancing existing kits. Single chosen targets are implicit in descriptions; group targets and self-granted effects are explicit. Area attacks need no chosen target, resolve living opponents in board order and stop on actor knockout. Enemy targets exclude backup. [Journey rules](EXPEDITION_DESIGN.md#encounters) own room scaling, including extras and mixed Block/Thorns branches.

Guard and Dodge use the definition's `target` field for recipient scope: `allAllies`
resolves automatically over living allies, including Minions. Guard defaults to a
chosen ally and also supports `self`; Dodge defaults to self. Stable card IDs are
independent of effect names. [Card rules](../src/game/card-rules.ts) own targeting
and descriptions; [execution](../src/game/combat/ability-handlers.ts) owns recipients.

## Content provenance

On October 23, 2026, the project owner confirmed that all player-facing content was produced by them using AI. The [owner declaration](../assets/content-provenance.json) covers artwork, music, sound effects and text; per-asset source locations and hashes remain in the manifest, including copies from Alchemy. This is pre-generated content; no live generation service runs in the game. [Store preparation](STEAM_STORE.md) owns the disclosure draft. Retain applicable generation-service terms and required attribution with source materials; this declaration does not itself grant rights.

## Artwork contracts

- **Creature cards: 4:3 landscape, full bleed.** Original production portraits are preserved PNG selections; runtime derivatives use the prepared-media recipe.
- **Location cards: 4:3 landscape.** Original 800 × 600 SVG placeholders in `public/art/locations/`, with names and encounter labels rendered outside the artwork. `scripts/assets/create-location-placeholders.mjs` rewrites only these placeholders.
- **Boon cards: 3:4 portrait, matching hand cards.** Boon displays use dedicated portraits in `public/art/boons/`; keep names and effects outside the artwork.
- **Action cards: 3:4 portrait, full bleed.** Each creature has three dedicated production PNG illustrations.

Use native aspect ratios without stretching or converting one composition into another. Preserve selected originals under `public/art/` or the source library, register them in `assets/manifest.json` and prepare outputs explicitly. Names and rules are UI text; never bake them into art. Branding alone may contain the Fauna wordmark.

[UI contracts](UI.md#layout-artwork-size-and-spacing) own displayed dimensions, contain rendering and overlay exceptions. [Inspection](ui/screens.md#creature-and-action-inspection) owns the current passive, stars and ability disclosure. Source resolution is independent of CSS display size.

### Branding selection

The main menu logo selection uses `Fauna_Gamboloom_Logo.png` from Google Drive, preserved in `public/art/branding/` and registered as `logo.main-menu`. Its lossless WebP derivative retains transparency and the complete composition. Branding includes the Fauna wordmark; gameplay artwork keeps the text-free rule above. The menu retains its accessible Fauna heading and uses the shared artwork sizing profiles.

## Keyword artwork

The [manifest](../assets/manifest.json) identifies keyword/category portraits, copy recipes and later Alchemy source selections. The [original nine-source mapping](archive/ALCHEMY_ADOPTION_PLAN.md#keyword-source-selections) retains provenance referenced by older manifest entries. These unchanged Alchemy portraits are Fauna-owned copies, independent of Alchemy's mechanics or runtime. Water reuses [Coralcurl's Reef Jet](content/creatures/coralcurl.md). Use contain rendering and the [talents overview sizing rule](ui/screens.md#talents).

## Prepared assets

The [manifest](../assets/manifest.json) owns stable media IDs, source selections, versioned recipes, aspect ratios, provenance and rights notes. Artwork sources stay under `public/art/`; sound/music sources use `~/Documents/Asset Library` or `ASSET_LIBRARY_ROOT` with library-relative selections.

| Stage    | Action and result                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Author   | Register source selections and recipes in the manifest; preserve upstream license metadata                                                                                                                                                                    |
| Prepare  | `npm run assets:prepare` validates all sources and publishes a complete generation                                                                                                                                                                            |
| Validate | After authoring, run `npm run assets:check` for selected source bytes, recipes and output hashes; `npm run assets:check:outputs` checks committed outputs without the library                                                                                 |
| Review   | `npm run assets:review` writes original/prepared comparisons, a contact sheet and size summary under `reports/art-review/index.html`; inspect at 2× density, then review hand, creature, Collection and inspection through [UI review](UI.md#required-review) |
| Build    | Ordinary dev/build commands run output-only checks and consume prepared outputs without regeneration or library access; `npm run assets:check:bundle` validates an existing build's active media inventory and budgets                                        |

Preparation preserves originals, library files and historical generations. Never edit generated files by hand. Explicit cleanup may retire unreferenced tracked outputs only after validating the active lookup and checking all repository references; preserve originals and active objects, with retired outputs recoverable from Git.

Immutable objects live under `public/prepared/objects/<fingerprint>/`, with hash receipts. Fingerprints include source bytes, recipe settings, output format and encoder toolchain; unchanged objects are reused without rewriting or re-encoding. The generated `src/assets/prepared.json` lookup and publication receipt changes atomically only after every output validates. Missing sources, corrupt objects or encoding failures leave the previous pointer intact. Output-only checks enforce recipes without requiring the preparing machine's exact native encoder versions; source checks also verify source bytes.

### Artwork resolution and quality

The [art recipes](../scripts/assets/art-recipes.mjs) own `card-webp`: lossless WebP fitting PNG art within 960 × 960 pixels, without cropping, stretching or enlargement. This supports a 480 CSS-pixel long edge at 2× device pixel ratio, covering current standard/battle, hover, Collection and inspection sizes. Size for CSS dimensions × device pixel ratio, not print DPI; see [responsive image sizing](https://web.dev/articles/responsive-images). Smaller sources retain native resolution. Existing optimized WebP and SVG selections use byte-preserving copies; the viewport-fitted talents overview retains native WebP sources without claiming arbitrary 2× detail. Recipe changes invalidate selections and cache keys.

Lossless encoding preserves resized pixels and alpha, but downsampling changes pixels and still needs visual review. Raster validation fully decodes sources/outputs, rejects animated or oriented artwork, and checks geometry/hashes. Receipts retain source/output byte counts and prepared dimensions. These checks establish neither artistic suitability, source-license clearance nor listening or hardware acceptance; manifest provenance is not a license grant.

### Build inventory

Runtime artwork/audio resolves IDs through the generated lookup. Builds disable automatic public-directory copying and emit only active media plus the build receipt; originals, cache receipts and old generations stay out of the renderer. Validation rejects extra/missing media, changed bytes and unapproved public resources. Limits are 128 MiB total media and 3 MiB per image; JavaScript has its [separate budget](../scripts/README.md#bundle-allowance). Retained historical generations do not enlarge new builds.

### Audio selections

Recorded cues cover typed combat outcomes, healing, defense, rejection, knockouts, recruitment, talents and battle outcomes; menu/combat/Boss music is selected independently of Alchemy's routes. Playback follows committed commands and quiet-preview policy without controlling gameplay, saves or admission. Volume is Master × Music or Master × Sound effects, with background mute and a Sound toggle; preferences remain outside progression. Current selections still need Fauna listening/mix review through the [Sound desk](DEVELOPMENT_TOOLS.md#prepared-media-and-sound-desk).

## Boon selections

[boons.ts](../src/game/content/boons.ts) owns available Boons, IDs, names and catalog order. [Boon rules](../src/game/rules/boons.ts) own numeric parameters and their displayed descriptions; execution and visible assessments use those same parameters. [Modifier bindings](../src/game/modifier-bindings.ts) identify the implementation functions; [Boon regressions](../tests/unit/game/boons.test.ts) protect timing, caps, actual-outcome triggers and recursion limits.

Portraits are unchanged WebP selections copied from `Alchemy: src/assets/optimized/`; the manifest records per-file sources, rights and hashes. Light replaces Alchemy's Holy terminology. Forge, Wish, Potion and Companion Boons are excluded because Fauna lacks their mechanics; Consume-dependent Boons and talents are excluded despite Pearls using Consume.

[Journey rules](EXPEDITION_DESIGN.md#currency-and-items) own reward pools and journey-only ownership; [Merchant rules](EXPEDITION_DESIGN.md#optional-support-visits) own stock and prices. Inspect new portraits through the UI review procedure.

## Support encounter content

[destinations.ts](../src/game/destinations.ts) owns support eligibility, saved stock, prices and receipts under the [journey rules](EXPEDITION_DESIGN.md#optional-support-visits). Merchant art uses Silken Clearing as a placeholder; replace it through the prepared-asset workflow when final art is selected.

## Encounter placeholders

`public/art/encounters/` preserves blank landscape SVGs registered as `encounter.combat` and `encounter.boss`; location assets remain available for support art. [Encounter presentation](ui/screens.md#encounter-and-required-replacement) uses blank Combat art and species art for Bosses. The music ID `music.fernwood` identifies a recording, not a biome or progression rule.

## Creature passive tiers

Each species defines six complete `passiveTiers`, indexed by zero through five stars. Every tier must differ in gameplay effects from every other tier: amounts, chances or mechanics may change; wording, property order and effect order alone do not qualify. Each tier replaces the entire previous passive, so retain all intended effects explicitly. Types require six entries and catalog validation rejects duplicate effect sets.

Favor species-exclusive mechanics independent of named abilities. Add new mechanics to the typed passive contract, execution, descriptions and focused regressions together. Player rules and previews use permanent rank; enemies use the base tier. [Journey progression](EXPEDITION_DESIGN.md#collection-and-passive-ranks) owns copy counts and ranks; [inspection](ui/screens.md#creature-and-action-inspection) owns disclosure.

## Shared Food cards

[Food definitions](../src/game/content/food.ts) own species-independent Apple, Mana Berries and Trail Bread. They cost 1 Mana, have Consume and are generated as temporary, level-zero cards with no creature owner. Keep them outside species kits and starter decks. [Orifable](content/creatures/orifable.md#shared-food) records targeting, generation, ownership and progression; [Food execution](../src/game/combat/food.ts) owns creation and use. Neutral cards remain usable after creator departure, participate in ordinary draw/overflow and expire with the battle. Save validation admits neutral ownership only for supported Food.

## Battle pile artwork

The user authorized unchanged 420×560 Alchemy copies for `pile.draw`, `pile.discard` and `card.back`. The manifest records their sources under `public/art/battle/`; preserve source-library originals and placeholders; earlier prepared outputs remain recoverable from Git. Flying discards match the source top-card bounds: x=25/420, y=25/560, width=328/420, height=432/560. Display keeps the 3:4 ratio.

## Creature references

The [creature index](content/creatures/README.md) links kits, distinctive edge rules and artwork rationale. The manifest owns per-file provenance/rights; dated rendered observations remain historical evidence. Shared authoring and preparation rules belong here.

[Memento](content/creatures/memento.md) records its four original selections and proposed Echo/Pearl artwork; [generation prompts](content/creatures/memento-art-prompts.md) retain the references and intent.
