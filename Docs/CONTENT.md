# Content and artwork

Author creature stats, six passive tiers and three unique abilities together in `src/game/content/creatures/`. [Creature catalogs](../src/game/content/creatures.ts) retain separate, explicit species/card order; seeded offers consume it. Talent trees live in `src/game/content/talents/`, aggregated by [talents.ts](../src/game/content/talents.ts). Keep shared definition types/builders outside individual kits. Use the [card builders](../src/game/content/card-builders.ts) with each complete, stable definition ID and effect-specific options; they supply species, the fixed Mana cost and the artwork key derived from the name. Override `artwork` explicitly when its key differs from that name.

Use the [Talent builder](../src/game/content/talent-builder.ts) to author each stable ID, name and explicit row in the 1–2–3–4 sequence specified by [talent progression](KEYWORDS.md#talent-rows). It derives keyword/effect identity from the ID and reads the description from the pure [Talent rules](../src/game/rules/talents.ts), where copy and executable parameters are authored together. Publication still freezes the complete plain definitions; keep tree and aggregate order explicit.

`src/game/content.ts` exposes catalogs, types and lookups. Import descriptions/enemy adaptation from [card-rules.ts](../src/game/card-rules.ts), intrinsic values/costs from [ability-rules.ts](../src/game/ability-rules.ts), and progression calculations from [progression.ts](../src/game/progression.ts). [Content validation](../src/game/content-validation.ts) owns startup/authoring checks separately from save decoding. New effects must complete the [ability rule and execution contracts](ARCHITECTURE.md#ability-rules).

After changing player-facing names or rules, follow [localization authoring](LOCALIZATION.md#explicit-ui-messages): regenerate English catalogs and shipped imports, review affected translations, and check placeholders and glyph coverage. New runtime rule branches need extraction coverage or an explicit fallback; unchanged gameplay IDs do not make changed English translations fresh.

Use [Creature design](CREATURE_DESIGN.md) for artwork-led kits, budgets and Boss/Legendary design. Recommend one coherent kit; offer alternatives when requested or when a consequential choice remains unresolved. [Journey design](EXPEDITION_DESIGN.md) owns recruitment, deployment and rewards; [Architecture](ARCHITECTURE.md#save-contract) owns persistence.

## Adding ability mechanics

Reuse an existing kind when its behavior already fits. A new primary kind belongs in [ability-types.ts](../src/game/rules/ability-types.ts), its complete policy in the [rule catalog](../src/game/rules/abilities.ts), and its mutation handler in [ability-handlers.ts](../src/game/combat/ability-handlers.ts). The compiler requires a complete policy and an execution case for every kind. Reuse the catalog’s shared automatic support policy when appropriate; override targeting, scaling, enemy support/adaptation and keywords beside the description when they differ. Keep authored cards data-only; presentation consumes card queries instead of handlers.

Primary target options in `ability-types.ts` define both the authored TypeScript types and runtime content validation. An ability without an entry cannot author a target; keep its targeting policy and execution behavior consistent with those options.

Supplemental effects have their own complete [rule catalog](../src/game/rules/supplemental.ts) and [execution catalog](../src/game/combat/ability-extras.ts). Declare whether they follow the primary recipient or the global delivery window, and whether reflection returns them or leaves them with the actor. Keep authored order. Update the application's explicit benefit assessment when a new mechanic affects Auto-play; gameplay owns reusable visible facts, while application owns priorities and deliberate approximations.

Recipient-only Healing and Cleanse require a Healing primary or an ally-targeted Recover primary. Supplemental damage and target Purge require an individual opposing attack recipient; group attacks do not supply that recipient. Validation rejects combinations that execution cannot deliver.

Add focused player-behavior regressions for new mechanics. Refactors must preserve the pre-extraction [ability baselines](../tests/unit/game/ability-contracts.test.ts), ordered events and RNG consumption; do not regenerate expectations merely to accept changed results.

## Adding gameplay modifiers

Use `npm run modifier:lookup -- dodge.finding-rhythm` for an existing multi-stage example: it shows damage accumulation, Dodge reset, chance query, definition and test references. Try `npm run modifier:lookup -- pumpkin-tureen` for a Boon. Bound owners are authoritative; definition and test references are literal navigation hints and can miss indirect consumers. Binding order is not reaction order. Add a Talent, Boon or passive kind together with its named implementation binding in [modifier-bindings.ts](../src/game/modifier-bindings.ts). Bind the functions that actually select and implement it at the existing execution stages. Declare all implementation sites when a rule participates in several stages, and keep gameplay query interpretations in `modifierQueries`. The [ownership contract](ARCHITECTURE.md#modifier-ownership) checks completeness, actual selectors and runtime connections; a new definition alone cannot establish implementation support. Bindings remain explicit: discovering selectors alone cannot identify a missing intended owner or independently check its typed module/export reference.

Keep effect order explicit in the owning coordinator. Adding or reordering catalog entries must not establish reaction order. Preserve live side/deployment checks and actor-liveness checks between child reactions. Add a focused regression for observable behavior; preserve the recorded [modifier baseline](../tests/unit/game/modifier-contracts.test.ts) during refactors. Intentional mechanic changes require reviewed expectations. Every passive tier remains a complete replacement; the passive-tier authoring procedure below applies.

Use the pure [Talent rules](../src/game/rules/talents.ts) for descriptions and executable parameters; derive numeric copy from the adjacent parameters. `percent` is a whole percentage; divide by 100 for a chance or ratio. The [Boon rule owner](../src/game/rules/boons.ts) supplies Boon parameters and descriptions. Preserve authored non-numeric clauses and complete passive tier objects. When a modifier grants a saved effect, bind its producer, later consumption and relevant queries; consumers spend the existing grant without rechecking current Talent ownership. Finding Rhythm's accumulation, reset and chance read are the worked example in [modifier ownership](ARCHITECTURE.md#modifier-ownership).

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

The [October 23 owner declaration](../assets/content-provenance.json) records artwork, music, sound effects and text as pre-generated AI content. Preserve that historical record, but do not treat its blanket sound-effect claim as current provenance: `Alchemy: THIRD_PARTY_NOTICES.md` records the owner's later clarification that sound effects are not AI-generated and their sources and distribution terms still require review. Fauna's manifest identifies its sound selections as copies from that shared library. Reconcile those selections with their actual sources and terms before release; neither the older declaration nor copied bytes establishes their origin or permission.

The manifest owns per-asset locations, hashes and rights notes. Retain applicable generation-service terms and required attribution with source materials. No live generation service runs in the game. [Store preparation](STEAM_STORE.md) owns the draft disclosure for artwork, music, written content and translations; sound-effect provenance remains an explicit open release item.

## Artwork contracts

- **Creature cards: 4:3 landscape, full bleed.** Original production portraits are preserved PNG selections; runtime derivatives use the prepared-media recipe.
- **Location cards: 4:3 landscape.** Original 800 × 600 SVG placeholders in `public/art/locations/`, with names and encounter labels rendered outside the artwork. `scripts/assets/create-location-placeholders.mjs` rewrites only these placeholders.
- **Boon cards: 3:4 portrait, matching hand cards.** Boon displays use dedicated portraits in `public/art/boons/`; keep names and effects outside the artwork.
- **Action cards: 3:4 portrait, full bleed.** Each creature has three dedicated production PNG illustrations.

Use native aspect ratios without stretching or converting one composition into another. Preserve selected artwork originals under `public/art/`, register them in `assets/manifest.json` and prepare outputs explicitly. Names and rules are UI text; never bake them into art. Branding alone may contain the Fauna wordmark.

[UI contracts](UI.md#layout-artwork-size-and-spacing) own displayed dimensions, contain rendering and overlay exceptions. [Inspection](ui/screens.md#creature-and-action-inspection) owns the current passive, stars and ability disclosure. Source resolution is independent of CSS display size.

### Branding selection

The main menu logo selection uses `Fauna_Dreamsunder_Logo.png`, selected by the user on 2026-11-04 from Google Drive, preserved in `public/art/branding/` and registered as `logo.main-menu`. Its lossless WebP derivative retains transparency and the complete composition. Branding includes the Fauna wordmark; gameplay artwork keeps the text-free rule above. The menu retains its accessible Fauna heading and uses the shared artwork sizing profiles.

## Keyword artwork

The [manifest](../assets/manifest.json) identifies keyword/category portraits and copy recipes. These unchanged Alchemy portraits are Fauna-owned copies, independent of Alchemy's mechanics or runtime. Water uses the [wave-in-a-droplet category artwork](../design/visual-quality/water-category.md) selected on 2026-11-04, generated using the locked Fauna style prompt adapted to a portrait category emblem. Use contain rendering and the [talents overview sizing rule](ui/screens.md#talents).

The original nine keyword portraits were copied unchanged from `Alchemy: src/assets/optimized/` at 420 × 563 pixels. Local files below are under `public/art/keywords/`. Later Armor, Bleed, Dodge, Leech and Mana portraits have exact source paths in the manifest.

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

## Prepared assets

The [manifest](../assets/manifest.json) owns stable media IDs, source selections, versioned recipes, aspect ratios, provenance and rights notes. All sources belong to this repository: artwork stays under `public/art/`, interface sprites under `public/ui/`, and sound/music originals under `assets/source/audio/`. Preparation rejects external origins and sources that resolve outside the checkout. No asset command requires an external library or uses `ASSET_LIBRARY_ROOT`.

Audio selections retain their historical library-relative paths in `originalSource` for provenance only; tooling never reads those paths. Shared cues reuse one local source. To update a selection, explicitly import the new source and its rights metadata into the repository, update the manifest and prepare it; upstream edits never update Fauna automatically. Imported audio preserves the previously selected bytes, provenance, rights notes and pending listening status.

| Stage    | Action and result                                                                                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Author   | Register source selections and recipes in the manifest; preserve upstream license metadata                                                                                                                                                                    |
| Prepare  | `npm run assets:prepare` validates all sources and publishes a complete generation                                                                                                                                                                            |
| Validate | After authoring, run `npm run assets:check` for selected source bytes, recipes and output hashes; `npm run assets:check:outputs` checks committed outputs without reading originals                                                                           |
| Review   | `npm run assets:review` writes original/prepared comparisons, a contact sheet and size summary under `reports/art-review/index.html`; inspect at 2× density, then review hand, creature, Collection and inspection through [UI review](UI.md#required-review) |
| Build    | Ordinary dev/build commands run output-only checks and consume prepared outputs without regeneration; `npm run assets:check:bundle` validates an existing build's active media inventory and budgets                                                          |

Preparation preserves repository originals and historical generations. Never edit generated files by hand. `npm run assets:prune` plans explicit cleanup; `-- --apply` retires only unreferenced tracked outputs after validating the active lookup and checking repository references. Preserve originals and active objects, with retired outputs recoverable from Git. [Resource efficiency](RESOURCE_EFFICIENCY.md#explicit-maintenance) owns maintenance safeguards.

Immutable objects live under `public/prepared/objects/<fingerprint>/`, with hash receipts. Fingerprints include source bytes, recipe settings, output format and encoder toolchain; unchanged objects are reused without rewriting or re-encoding. The generated `src/assets/prepared.json` lookup and publication receipt change atomically only after every output validates. Missing sources, corrupt objects or encoding failures leave the previous pointer intact. Output-only checks enforce recipes without requiring the preparing machine's exact native encoder versions; source checks also verify source bytes.

### Artwork resolution and quality

The [art recipes](../scripts/assets/art-recipes.mjs) own `card-webp`: lossless WebP fitting PNG, JPEG or WebP originals within 1440 × 1440 pixels, without cropping, stretching or enlargement. This supplies a 720 CSS-pixel long edge at 2× or 480 at 3× before hover headroom. Size for CSS dimensions × device pixel ratio, not print DPI; see [Apple's image delivery guidance](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/SafariImageDeliveryBestPractices/ServingImagestoRetinaDisplays/ServingImagestoRetinaDisplays.html). Recipe changes invalidate selections and cache keys.

The generated runtime lookup retains actual prepared dimensions. [ArtCard](../src/ui/shared/cards/art-card.tsx) limits raster artwork to those pixels divided by at least 2×, or the display's higher actual scale, with headroom for hover and the battle discard flip. The shared [density owner](../src/ui/shared/artwork-density.ts) follows zoom and display changes without a listener per card. Vectors remain resolution independent. The sole approved exception is talent-category artwork: on 2026-11-04 the project owner retained those portraits at their existing resolutions and displayed sizes. Do not apply that exception to other artwork.

The 18 older Boon portraits and battle pile/card-back selections now use their full-resolution Google Drive originals, preserved unchanged under `public/art/`; their manifest entries retain the source links. Other selected originals remain preserved there too. Smaller sources never gain detail by enlargement; supply a larger original when increasing a surface beyond its pixel budget. [UI contracts](UI.md#layout-artwork-size-and-spacing) own the display behavior.

The custom cursor uses the unchanged [64 × 64 Drive original](https://drive.google.com/file/d/1ijTmT5atV_TFPKuEIra0hAIXfoBBdz86/view) in `src/ui/shared/assets/pointer-c-shaded.png`. Its CSS image-set preserves the existing 26 CSS-pixel size while those pixels cover the display scale, then limits it to 64 device pixels at higher scales. The hotspot remains at the top-left corner.

Lossless encoding preserves resized pixels and alpha, but downsampling changes pixels and still needs visual review. Raster validation fully decodes sources/outputs, rejects animated or oriented artwork, and checks geometry/hashes. Receipts retain source/output byte counts and prepared dimensions. These checks establish neither artistic suitability, source-license clearance nor listening or hardware acceptance; manifest provenance is not a license grant.

### Build inventory

Runtime artwork/audio resolves IDs through the generated lookup. Builds disable automatic public-directory copying and copy only active media plus the build receipt; originals, cache receipts and old generations stay out of the renderer. Validation rejects extra/missing media, changed bytes and unapproved public resources. The [active-media validator](../scripts/assets/active-assets.mjs) enforces media limits; JavaScript has its [separate budget](../scripts/README.md#bundle-allowance). Aliased IDs share files and the unused Marsh recording remains excluded. [Resource efficiency](RESOURCE_EFFICIENCY.md#inventory-and-budgets) owns current inventory commands, allowances and maintenance. Retained historical generations do not enlarge new builds.

### Audio selections

Recorded cues cover typed combat outcomes, healing, defense, rejection, knockouts, recruitment, talents and battle outcomes; menu/combat/Boss music is selected independently of Alchemy's routes. Playback follows committed commands and quiet-preview policy without controlling gameplay, saves or admission. Volume is Master × Music or Master × Sound effects, with background mute and a Sound toggle; preferences remain outside progression. Current selections still need Fauna listening/mix review through the [Sound desk](DEVELOPMENT_TOOLS.md#prepared-media-and-sound-desk).

## Boon selections

Use the [Boon design skill](../.agents/skills/fauna-boon-design/SKILL.md) for artwork-led proposals and mechanic redesigns. [Boon contracts](content/boons.md) locate the catalog, exact descriptions, execution interactions and saved effects. Add implementations through the [modifier authoring procedure](#adding-gameplay-modifiers); prepare portraits through the shared media pipeline.

## Support encounter content

[destinations.ts](../src/game/destinations.ts) owns support eligibility, saved stock, prices and receipts under the [journey rules](EXPEDITION_DESIGN.md#optional-support-visits). Merchant art uses Silken Clearing as a placeholder; replace it through the prepared-asset workflow when final art is selected.

## Encounter placeholders

`public/art/encounters/` preserves blank landscape SVGs registered as `encounter.combat` and `encounter.boss`; location assets remain available for support art. [Encounter presentation](ui/screens.md#encounter-and-required-replacement) uses blank Combat art and species art for Bosses. The music ID `music.fernwood` identifies a recording, not a biome or progression rule.

## Creature passive tiers

Within each tier, combined Block retention bonuses cannot exceed 100%, so decay never creates Block. Combined Unfinished Journey allowances cannot exceed the saved counter limit in [state-limits.ts](../src/game/state-limits.ts); content validation and the save schema share that limit.

Each species defines six complete `passiveTiers`, indexed by zero through five stars. Every tier must differ in gameplay effects from every other tier: amounts, chances or mechanics may change; wording, property order and effect order alone do not qualify. Each tier replaces the entire previous passive, so retain all intended effects explicitly. Types require six entries and catalog validation rejects duplicate effect sets.

When only an amount or chance changes, use [sixPassiveTiers](../src/game/content/passive-tiers.ts) with six explicit values and one builder for the complete tier:

```ts
passiveTiers: sixPassiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
  description: `Retain ${amount}% more Block between turns`,
  effects: [{ kind: "blockRetention", amount }],
})),
```

The helper expands the progression into the same six plain tier objects before catalog publication. Keep uneven values explicit and preserve special descriptions at guaranteed chances. When mechanics change between ranks, keep the six authored tiers explicit, as in [Pollenmoth](../src/game/content/creatures/pollenmoth.ts). Each builder call must create its complete effects; tiers never inherit from previous ranks. The catalog owns freezing and validation for both forms.

Favor species-exclusive mechanics independent of named abilities. Add new mechanics to the typed passive contract, execution, descriptions and focused regressions together. Player rules and previews use permanent rank; enemies use the base tier. [Journey progression](EXPEDITION_DESIGN.md#collection-and-passive-ranks) owns copy counts and ranks; [inspection](ui/screens.md#creature-and-action-inspection) owns disclosure.

## Shared Food cards

[Food definitions](../src/game/content/food.ts) own the species-independent Apple, Mana Berries and Trail Bread effects and artwork IDs. [Food execution](../src/game/combat/food.ts) owns creation and use. Food is level zero and explicitly neutral-owned; generated Food is temporary. Keep its definitions outside species kits. Food awards no separate progression keyword, while its actual effects retain ordinary keyword XP.

Food costs 1 Mana and has no species or creature owner. Generated Food lasts only for the battle. Apple and Trail Bread use ordinary living-ally targeting, including allied Minions; Mana Berries resolve immediately into shared Mana. A Berry therefore gains one net Mana before the shared cap. Pumpkin Tureen makes Apple and Trail Bread automatic group effects, with living backup healing only through Camp Hammock; Mana Berries remain shared. Field Lunch Basket draws one card after each accepted Food play, after any repeat and before ordinary accepted-play reactions. Escape cancels targeting without consuming Food or Mana.

Food survives its creator falling, swapping out, or a Legendary formation change. It remains drawable and recoverable, and Well Read copies retain neutral ownership. Unplayed Food discards and recycles normally. An accepted play Consumes the played card after resolution; a pending Dancing Double resolves its effects twice before that single consumption. Rejection preserves the card and RNG. Preview uses the same resolution on detached state.

Cornucopia adds a journey-owned Mana Berries card and Toadstool Breadbox adds a journey-owned Trail Bread when acquired. [Journey cards](../src/game/journey-cards.ts) own their stable identities and replenishment. Both remain visible between battles and survive formation changes; consuming one removes only the current battle's copy, and battle settlement replenishes it. Other generated Food remains battle-only.

Food does not spend creature free-card charges, use creature-specific ability repeats or increment an acting creature's card counters. It remains usable while creatures are controlled; general team accepted-play effects, keyword XP, recipient modifiers, talents and Boons retain their ordinary rules. Neutral cards are represented explicitly in the save schema: supported temporary Food and both Boon-granted journey cards are level zero and have no owner. Validation requires each journey card's exact identity and corresponding Boon; outside battle both owned grants must be present. The current [save format](../src/game/save-format.json) rejects obsolete development saves rather than migrating them.

Aerostat's [Well Provisioned](content/creatures/aerostat.md) supplies Food before opening draws each battle. Orifable's [Care Package](content/creatures/orifable.md#abilities-and-progression) and Aerostat's Parcel Drop create additional Food during combat through the same generation owner. Well Provisioned restores its tier's starting supplies each new battle; extra combat-created Food expires with that battle. [Food artwork prompts](content/creatures/orifable-art-prompts.md) retain original generation provenance.

## Battle pile artwork

`pile.draw`, `pile.discard` and `card.back` use the full-resolution Drive originals under `public/art/battle/`, replacing the earlier reduced Alchemy copies. The manifest retains exact sources and reuse authorization; preserve originals and prepare derivatives through the shared pipeline. [Hand motion](../src/ui/battle/hand-motion.tsx) uses normalized top-card bounds for flying discards: x=25/420, y=25/560, width=328/420, height=432/560. Those fractions describe geometry, not required source dimensions. Display keeps the 3:4 ratio.

## Creature references

The [creature index](content/creatures/README.md) links kits, distinctive edge rules and artwork rationale. The manifest owns per-file provenance and rights. Shared authoring and preparation rules belong here.

[Memento](content/creatures/memento.md) records its four original selections and proposed Echo/Pearl artwork; [generation prompts](content/creatures/memento-art-prompts.md) retain the references and intent.
