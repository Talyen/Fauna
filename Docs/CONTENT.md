# Content and artwork

`src/game/encounters.ts` owns encounter progression, enemy packs, and initial encounter scaling. `src/game/content.ts` retains the stable legacy encounters and owns the species roster, card definitions, displayed effect descriptions, and encounter templates. Each species contributes exactly three unique card definitions. Content validation runs at startup and in tests. Keep IDs stable once saves are supported.

The roster consists of Mossguard, Emberback, Pollenmoth, Prismram, Captoad, Dunefox, Reedstag, Cindernewt, Coralcurl and Chimecricket. All ten are eligible for the first journey; three distinct choices are offered. Later journeys draft only collected species. Ordinary encounters and boss escorts use this same roster; victory grants no additional species unlock. Save version 31 rejects obsolete development saves without migration. Each deployed creature contributes three cards, so the starting three-card deck grows to nine cards with a full lineup; recruitment adds defeated species to the five-slot roster. Only the deployed lineup of up to three creatures contributes cards, and free combat swaps replace cards in their existing zones. Starting lineups are remembered and optionally editable from the menu between battles. Health and knockouts persist between battles; Campfire appears beside the encounter whenever any roster creature, including a backup or knockout, is missing at least 30% of maximum Health. Rest restores 30% maximum Health to the whole roster, capped at full Health, and returns to the same combat encounter without advancing the encounter or changing RNG. It remains available while the threshold is met. There is no elemental chart.

## Ability costs

Every ability, for every creature, has a base cost of exactly **1 Mana**. This applies to all current and future action cards, including attacks, defense, healing and utility. Balance abilities through their damage, protection, status effects and other values rather than varying their authored Mana cost. Card upgrades retain the same base cost. Explicit gameplay modifiers such as talents that make a play free still apply at runtime.

## Artwork contracts

- **Creature cards: 4:3 landscape, full bleed.** Production portraits are unchanged PNG selections.
- **Location cards: 4:3 landscape.** Original 800 × 600 SVG placeholders in `public/art/locations/`, with names and encounter labels rendered outside the artwork. `scripts/create-location-placeholders.mjs` rewrites only these placeholders.
- **Boon cards: 3:4 portrait, matching hand cards.** Boon displays use dedicated portraits in `public/art/boons/`; keep names and effects outside the artwork.
- **Action cards: 3:4 portrait, full bleed.** Each creature has three dedicated production PNG illustrations.

Displayed artwork uses one equal-area size standard: 200×266⅔ portrait and 266⅔×200 landscape in CSS pixels, at every viewport. Battle explicitly enlarges creatures by 10% and reduces hand cards by 10%. Layouts reflow or scroll instead of scaling artwork; source asset resolution is independent of displayed size. See [layout rules](UI.md#layout-artwork-size-and-spacing).

These are separate compositions, not crops of one format into another. Replace the selected sources in `public/art/` or the shared library, update `assets/manifest.json` where needed, and explicitly prepare the new generation. Images use their native aspect ratio with no stretching. All text is rendered by the UI, not baked into artwork. Cards contain no text or UI overlays; names, stats and rules live in hover/focus details, including inside centered inspection. Stacked inspection presents three portrait action thumbnails under the creature artwork without visible captions or passive text. Selecting a thumbnail pins the complete action artwork in the same dialog; hover/focus reveals its rules. Keyboard/controller cycling has no Previous/Next buttons. Compact creature tooltips do not list actions; pinned enemy artwork reveals its collectible passive separately from battle state.

The retired creature placeholders and their authoring script have been removed; earlier immutable prepared generations remain preserved. Mana UI sprites were adapted from Alchemy; no species illustrations or fonts were copied from Alchemy. Keyword artwork reuse is documented below.

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

Sundering Charm removes 2 enemy Armor before Physical or Stun hit mitigation, after Dodge. Frozen Pocketwatch extends enemy Freeze to two skipped turns, followed by the existing shared immunity. Before allied turn-start damage, Plague Doctor's Mask removes up to 2 Poison from each living creature, including backup, and deals half the removed amount (rounded normally) as Poison to the first living enemy. Fully removing Poison triggers Cleanse rewards; partial stack removal does not.

Resonant Chimes refunds 1 shared Mana after the third accepted card of each turn, before automatic end turn. Repeated card effects count once. Its capped battle-wide counter survives previews, swaps and resume and resets each turn and battle. Merchant's Favor commits a 13 Gold price instead of 20 when each new Merchant stock is prepared; the one-purchase visit limit still applies. Smuggler's Map adds 2 Gold to victory rewards, including bosses, using ordinary settlement and retained-earnings limits. Save version 24 rejects obsolete development saves.

## Support encounter content

Merchant prices, affordability and Campfire eligibility/recovery are owned by `src/game/support.ts`. Stock selects from the existing Boon catalog and persists with each visit. Merchant currently reuses the prepared Silken Clearing location illustration, an explicit existing placeholder rather than a newly approved source-library selection. Boon portraits retain their existing asset manifests and receipts. Replace location selections through the prepared-asset workflow when final art is selected.

## Encounter placeholders

Ordinary Combat uses an original blank 4:3 SVG placeholder; the preserved Boss placeholder is retained in the manifest. Both original files remain in `public/art/encounters/`, registered as `encounter.combat` and `encounter.boss`. Labels remain outside the artwork. Enemy packs and encounter progression live in `src/game/encounters.ts`; named destination selection is removed. The existing location assets remain available for support artwork.

Journeys use one shared combat enemy pool, with bosses at encounters 4 and 8. There are no biome divisions. Combat music reuses the prepared track registered as `music.fernwood`; that source ID does not select progression. Boss entrances show their authored name and species artwork with base-trait hover/focus details. Ordinary encounters retain the blank Combat entrance. Activating either starts the saved battle directly, without revealing turn intents or opening a preview dialog.

## Creature passive tiers

Each species in `src/game/content.ts` owns six `passiveTiers`, indexed by stars from zero through five. The first recruitment collects the species at zero stars; the sixth reaches five. Counts persist across journeys and cap at six. Committing the first onboarding starter supplies one initial copy. Later starter drafts and encounter discovery do not grant copies.

Every species must define all six tiers, and each tier must have different gameplay effects from every other tier. Scaling effect amounts or chances is the usual approach; new mechanics can also distinguish tiers. Changed wording, object property order or effect order alone does not count. The type contract requires six defined entries, and catalog validation rejects missing or duplicate effect sets. A tier replaces the whole previous passive rather than adding to it; include all retained effects in its effect list. Tiers can compose card bonuses, opening defenses and recurring effects. Favor species-exclusive mechanics independent of named abilities. New mechanics belong in the typed passive effect contract and its gameplay consumers alongside matching descriptions and regression coverage. Player rules, previews and inspection use the tier at the permanent rank. Enemies always use the base tier. Inspection shows all six complete tiers, the current rank and the active effect.

Existing complete Overgrowth, Molten Shell, Cross-Pollination and Refraction progressions retain their authored effects. Sporecoat retaliates for 1 through 6 Poison damage.

## Battle pile artwork

`public/art/battle/draw-pile.webp`, `discard-pile.webp` and `card-back.webp` are unchanged 420×560 optimized artwork copied from `Alchemy: src/assets/optimized/`, with reuse explicitly requested by the user. The prepared manifest owns `pile.draw`, `pile.discard` and `card.back`; runtime has no sibling-project dependency. Draw and discard ArtCards preserve the 3:4 aspect ratio. Flying discards use the same top-card crop and landing bounds as Alchemy: x=25/420, y=25/560, width=328/420, height=432/560. The source library, original placeholders and earlier immutable prepared generations remain preserved.

## Talent category portraits

Armor, Bleed, Dodge, Leech and Mana now use their distinct existing Alchemy portraits, copied unchanged from `Alchemy: src/assets/optimized/talent-<keyword>.webp` into `public/art/keywords/`. These follow the existing Alchemy keyword-art reuse, with source provenance in `assets/manifest.json` and Fauna-owned prepared outputs. There is no runtime dependency on Alchemy.

## Emberback

Emberback is an armored brawler with 30 Health. Its unique passive, Molten Shell, reads: "When your Armor breaks, deal 1 Burn damage to all enemies" Damage scales from 1 through 6 at zero through five stars, replacing the previous tier. It grants no starting Armor. It appears in ordinary combat packs and becomes collectible through the existing recruitment flow.

All three abilities cost 1 Mana:

- **Ember Charge:** Deal 4 Physical damage; Gain 2 Armor
- **Furnace Breath:** Deal 2 Burn damage to all enemies
- **Magma Stomp:** Deal 2 Stun damage to all enemies

Ability design aims for roughly 6 total value per card across its affected targets, with adjustment for effects such as lasting statuses. This is a design guideline rather than an arithmetic equivalence between damage, Armor and control; it does not retroactively rebalance existing creatures. Single chosen targets are implicit in descriptions; group targets and self-granted effects are explicit. Area attacks resolve living opponents in board order and stop if retaliation knocks out the acting creature. Player area attacks need no chosen target; enemy area attacks affect deployed allies, excluding backup. Enemy area damage uses one third of encounter attack strength, rounded with a minimum of 1, rather than multiplying full single-target strength across the team.

The selected creature portrait (`04.png`) and three ability portraits are copied unchanged from the user's [Emberback Drive folder](https://drive.google.com/drive/folders/1BAcTaOpKsPQonWJ4mZzJgRE3se0SrGp9) into `public/art/emberback/`. The manifest records each original file URL. Ability-specific artwork is used consistently in battle, inspection and Collection. Ashen Vanish remains outside the playable kit; its Drive source is preserved. PNG selections are copied at their original resolution and aspect ratio without cropping or conversion. Prepared output checks do not establish rendered acceptance.

Molten Shell triggers once per positive-to-zero Armor transition, after the effect that removes Armor completes. Damage, periodic damage, shattering, Purge and Armor theft can break Armor. No burst occurs while Armor remains, when Armor was already zero, or after the creature is knocked out. New Armor can enable another burst. Burn packets use existing mitigation and buildup, without Dodge, Critical hits or ordinary attack retaliation. Player bursts use the collected tier and hit living enemies; enemy bursts use the base tier and hit deployed living allies. Passives should typically have a unique species mechanic and concise rules without naming abilities.

## Mossguard

Mossguard is a new species ID replacing the removed Mossback content and occupies its former starter and encounter slots. He has 32 Health and three 1 Mana abilities: Boulder Brace grants 6 Block to himself, Rooted Stomp deals 2 Stun damage to every living enemy, and Moss Renewal restores 2 Health to every living deployed ally, including himself. Group healing does not revive knockouts or affect backup. Upgrades and explicit gameplay modifiers use the existing rules.

Overgrowth retains 10%, 20%, 30%, 40%, 50% or 60% more Block at zero through five stars. This is a relative increase over the ordinary 50% retention: 55%, 60%, 65%, 70%, 75% or 80% of remaining Block survives, rounded normally. It applies on each turn transition, including in backup. Enemy Mossguard always uses the base tier. Save version 24 rejects obsolete development saves instead of migrating removed species or abilities.

The portrait and three distinct ability illustrations are unchanged PNGs imported from the user-provided [Mossguard Drive folder](https://drive.google.com/drive/folders/1xzid2xsfO4044-xra9i3KU1K1dx_Kxgz). Source provenance is recorded per file in the asset manifest. Removed Mossback placeholders are no longer selected; prior immutable prepared generations are preserved. Source art was inspected at native aspect ratios; in-game rendered review remains a separate gate.

## Pollenmoth

Pollenmoth is a 23 Health support creature encountered and recruited on ordinary routes. Each ability costs 1 Mana: Dazzle Burst deals 3 Light damage to a random living enemy; Petal Shelter gives living deployed allies 2 Block; Bloomwake restores 3 Health to the most injured living deployed ally, including Pollenmoth. Injury is measured by remaining Health percentage, with battlefield order breaking ties. Backup and knockouts are excluded.

Cross-Pollination has six complete passive tiers:

1. Light damage bounces once.
2. Light damage bounces once, with a 50% chance to bounce twice.
3. Light damage bounces twice.
4. Light damage bounces twice. Health restoration has a 50% chance to bounce once.
5. Light damage bounces twice. Health restoration bounces once, with a 50% chance to bounce twice.
6. Light damage and Health restoration bounce twice.

Each bounce repeats the original effect amount, with defenses and healing modifiers applied separately. Damage selects a random living opponent not already visited; healing selects the most injured remaining ally missing Health. Bounces cannot revisit a recipient or start another chain. A Dodged initial hit does not bounce; a knocked-out source stops its chain. Full-Health healing attempts do not bounce. Chance rolls and random targets use committed seeded combat randomness, so previews never consume live RNG. Enemy Pollenmoths use their base passive. Healing bounces belong to Pollenmoth's own healing abilities, not another creature's healing or automatic recovery.

The creature portrait and three dedicated action illustrations are unchanged copies from the user's Pollenmoth Google Drive folder. Their original URLs and rights notes are recorded in the asset manifest. Prepared assets retain the native 4:3 creature and 3:4 action compositions. Rendered gameplay review remains pending.

## Prismram

Prismram is a 30 Health crystal defender found in ordinary combat packs and collected through recruitment. All three abilities cost 1 Mana:

- **Prism Charge:** Deal 6 Physical damage
- **Faceted Ward:** Gain 3 Block; Reflect the next harmful status effect
- **Spectrum Lance:** Deal 4 Light damage; Purge target: remove 1 effect

**Refraction** gives harmful status effects received a 10%, 20%, 30%, 40%, 50% or 60% chance to redirect to a random living enemy at zero through five stars. Enemy Prismram always uses 10%. Faceted Ward guarantees the next reflection before passive chance is considered; repeated Wards refresh one pending reflection rather than stacking. The pending effect persists across turns, swaps and current-format saves, resets for each battle and can be Purged.

Reflection transfers the incoming Burn, Poison, Bleed, Stun or Freeze buildup at its original post-mitigation strength; direct damage still lands on the original target. The recipient uses normal control thresholds and immunity. Reflected effects belong to the reflecting creature and cannot reflect again. Only living deployed opponents are eligible, including the attacker. Fully blocked damage, periodic ticks, retaliation and immune control applications do not consume a Ward or roll Refraction. Save version 25 rejects obsolete development saves without migration.

The landscape portrait (`04.png`) and three portrait ability illustrations are unchanged PNGs from the user's [Prismram Drive folder](https://drive.google.com/drive/folders/1_-fYMW69ianG7xHrSc0fukfMX_kl42Vb), copied into `public/art/prismram/`. The manifest records the original file URLs. Creature and ability artwork use the shared prepared-media pipeline for battle, inspection and Collection. Source images were visually inspected; in-game rendered acceptance remains pending.

## Captoad

Captoad has 30 Health and joins ordinary encounter and recruitment pools. Its base passive, Sporecoat, reads "Retaliate with 1 Poison damage when hit"; retaliation scales from 1 through 6 Poison damage at zero through five stars. A landed direct attack triggers once even when Block or Armor absorbs it completely. Dodge, periodic damage, derived damage and retaliation do not trigger it. A knocked-out Captoad cannot retaliate. The Poison packet cannot Dodge, crit or start another retaliation; resolved Poison damage adds ordinary Poison stacks and source attribution, respecting Block and harmful-status reflection. Enemies use the same base passive.

All three abilities cost 1 Mana:

- **Spore Puff:** Deal 2 Poison damage to all enemies
- **Mushroom Guard:** Gain 3 Block; Restore 3 Health
- **Bogbound Leap:** Swap out for a random backup; Draw 2 cards

Mushroom Guard heals only its actor through ordinary card-healing rules. Bogbound Leap first selects a random living backup with seeded RNG, preserving both creatures' Health and effects and the remembered starting lineup. It removes the departing creature's cards from hand, overflow, draw and discard; the incoming three cards are shuffled into the draw pile before drawing two, making the new kit immediately drawable. Other creatures' cards retain their zones. With no living backup, it swaps battlefield positions with a random living ally; alone it still draws two. Enemy Leap swaps with another living enemy and has no shared-hand draw. Reordering never gives an enemy an extra action in that turn window and retains enemy identity for save validation. Free manual Swap retains its existing card-slot replacement behavior.

The unchanged portrait and three ability PNGs come from the user's [Captoad Drive folder](https://drive.google.com/drive/folders/16zyEo4h2IGJGun_C1VqTCqV3U3-HMdGI). Each source URL is recorded in the manifest; native 4:3 and 3:4 compositions are retained. Prepared output checks do not establish rendered acceptance. Player-facing vocabulary uses Backup in place of Reserves; internal save fields retain their existing names.

## Dunefox

Dunefox is a 24 Health evasive support creature available through ordinary encounters, recruitment and starter drafts. Each ability costs 1 Mana:

- **Sandburst Pounce:** Deal 6 Physical damage
- **Dune Whirl:** Deal 1 Physical damage to all enemies; Blind all enemies
- **Mirage Step:** Gain 30% Dodge until your next turn; Draw 1 card

**Shifting Sands** reads "Allies gain 15% of your Dodge chance" at zero stars and scales to 20%, 25%, 30%, 35% and 40% at one through five stars. Other living deployed allies receive that fraction of Dunefox's intrinsic current Dodge chance, including the ordinary 5%, talents and temporary bonuses, before adding received Shifting Sands bonuses. Multiple providers contribute independently without recursive amplification; Dunefox does not benefit from its own aura. Total Dodge remains capped at 75%. For example, Mirage Step raises an otherwise unmodified Dunefox to 35% Dodge, sharing 5.25 percentage points at the base tier. Knockouts and backup providers contribute nothing; swaps, control and expiring bonuses update the live aura automatically. Enemies use the base tier.

Blind grants a 50% chance to miss the next attack and expires after that attack whether it hits or misses. A single seeded roll covers all recipients and supplemental damage packets of that attack; support abilities, skipped turns, periodic damage and retaliation do not consume Blind. A miss emits the existing Dodge outcome and icon for each recipient and activates ordinary Dodge rewards, including against a recipient unable to Dodge normally. Blind is a harmful, non-stacking status that can be Cleansed or reflected once through the existing harmful-status owner. Dune Whirl applies Blind to surviving enemies after its damage, including enemies that Dodged that damage.

Mirage Step grants a separate temporary Dodge bonus, removed at the start of the owner's next turn, including in backup or on a skipped turn. Purge removes both ordinary and temporary granted Dodge together; unrelated permanent Dodge survives ordinary expiry. Enemy Mirage Step grants the same 30% Dodge and omits the player-only draw. Save version 27 stores Blind and temporary Dodge and rejects obsolete development saves without migration.

The unchanged landscape portrait and three action PNGs come from the user's [Dunefox Drive folder](https://drive.google.com/drive/folders/1NI9Ud-lqluU5whB6A3066vh2Oop5DUP3). Each original file URL is recorded in the asset manifest; the shared preparation pipeline retains native 4:3 creature and 3:4 action compositions. Source artwork was visually inspected; in-game rendered review remains pending.

## Reedstag

Reedstag is a 30 Health marsh guardian available through starter drafts, ordinary encounters and recruitment. All three abilities cost 1 Mana:

- **Reed Rush:** Deal 6 Nature damage
- **Reed Shelter:** Gain 3 Block and 3 Thorns
- **Mending Spring:** Restore 4 Health and Cleanse the most injured ally

Mending Spring selects the living deployed ally with the lowest remaining Health percentage, including Reedstag; battlefield order breaks ties. Healing and removal of all harmful effects apply to that same recipient, selected before healing. Full-Health allies remain eligible for Cleanse. Backup and knocked-out creatures are excluded. Enemy healing and cleansing select from living enemies and retain ordinary encounter-scaled healing.

**Reedguard** reads "Block and Thorns have a 20% chance to be shared with allies" and scales through 40%, 60%, 80% and 90% to "Block and Thorns are shared with allies" at five stars. Each positive Block or Thorns gain rolls separately, once for all other living deployed allies; success copies the amount actually gained without spending Reedstag's own gain. Card, talent and Boon grants participate. Shared gains never trigger further sharing, including through another Reedstag. Backup and knockouts neither share nor receive; enemies use the 20% base tier and share only with living enemies. Guaranteed sharing and gains with no eligible recipients consume no sharing RNG. Save version 28 rejects obsolete development saves without migration.

The unchanged landscape portrait (`05.png`) and three portrait ability PNGs come from the user's [Reedstag Drive folder](https://drive.google.com/drive/folders/1VpBD8PLbx5hEHMJTi1ZZv9NvCK_IRQRt). Each original URL is recorded in the asset manifest. The shared preparation pipeline retains native 4:3 creature and 3:4 action compositions. Source artwork was visually inspected; in-game rendered review remains pending.

## Cindernewt

Cindernewt is a 24 Health creature eligible for starter drafts, ordinary encounters and recruitment. Cinderstep reads "When you Dodge, deal 1 Burn damage to the attacker" and scales from 1 through 6 damage at zero through five stars. Enemies use the base tier. Both ordinary Dodge and Blind misses trigger it. Its retaliation uses normal mitigation, Burn buildup and source attribution, cannot Dodge or critically hit, and cannot trigger attack retaliation or another Dodge. Periodic and derived damage do not trigger Cinderstep.

All three abilities cost 1 Mana:

- **Cinder Lash:** Deal 6 Physical or Burn damage at random
- **Ember Breath:** Deal 1 Burn damage to all enemies; Remove 50% of all enemies’ Armor, rounded up
- **Ashen Veil:** Deal 1 Burn damage to all enemies; Blind all enemies

Cinder Lash selects Physical or Burn with equal probability using committed seeded randomness once per attack execution; repeats select again. Both authored damage categories participate in card XP, costs and card-level talent eligibility; resolved damage uses only the selected type. Previews use detached RNG and rejected commands consume none. Ember Breath melts surviving opponents' Armor after damage, even if they Dodged or blocked it. Five Armor loses three, and one loses one. Removing the last Armor triggers ordinary Armor-break passives; a knocked-out actor stops further effects. Ashen Veil applies Blind to surviving enemies after damage, including enemies that Dodged it. Enemy abilities use ordinary encounter damage scaling and affect deployed allies, excluding backup. Save version 29 rejects obsolete development saves without migration; the new roster uses existing combat fields.

The unchanged landscape portrait (`03.png`) and three action PNGs come from the user's [Cindernewt Drive folder](https://drive.google.com/drive/folders/1MBRRJHBSdA-mKYA4SR2L7l5wYCIOlCG1). Each original file URL is recorded in the asset manifest; native 4:3 creature and 3:4 action compositions are retained. Source artwork was visually inspected; in-game rendered review remains pending.

## Coralcurl and Water

Coralcurl has 28 Health and is available through ordinary encounters, recruitment and starter drafts. All abilities cost 1 Mana:

- **Bubble Ward:** Gain 6 Block
- **Reef Jet:** Deal 6 Water damage
- **Coral Spiral:** Swap out for a random backup; Blind all enemies

**Bubbleburst** reads "Deal 1 Water damage when your Block breaks" at zero stars and scales to 2, 3, 4, 5 and 6. When a direct attack spends the last Block, a surviving Coralcurl damages the living attacker, including an exactly absorbed attack. The captured break still triggers if another reward restores Block. Purge, expiry, periodic damage and retaliation do not trigger it; Bubbleburst cannot chain retaliation. Enemies use the base tier.

Coral Spiral follows the existing random living backup swap and card-zone rules, then Blinds every living enemy. Without backup it exchanges positions with a random living ally; alone it stays in place and still Blinds enemies. Enemy Spiral exchanges battlefield positions and Blinds deployed allies.

Water is a direct damage and talent category with its own blue token, distinct from Mana, Block and Freeze. Block absorbs Water; Armor does not reduce it, and it adds no status. Water cards earn Water XP once per accepted play; passive damage does not award card XP. The six Water talents form three rows: Pressure (+1 Water attack damage), Seafoam (Water hits grant 2 Block), High Tide (+25% Water attack damage while protected by Block), Erosion (Water hits remove 2 Armor), Cleansing Current (20% chance to Cleanse 1 harmful effect on a Water hit), and Riptide (20% chance to draw a Water card on a Water hit). Hit rewards include fully absorbed hits, exclude Dodges and require a surviving actor; passive damage cannot activate them.

The unchanged portrait and three action PNGs come from the user's [Coralcurl Drive folder](https://drive.google.com/drive/folders/19NVnBIdFleyfmnqCTyg4GeSiQkMbI2TE). The manifest records original URLs, and Water's talent artwork reuses Reef Jet. Water currently uses the existing generic impact audio. Save version 30 rejects obsolete development saves without migration. Source artwork was visually inspected; rendered gameplay and balance acceptance remain pending.

## Chimecricket

Chimecricket is a 24 Health musical support creature available through starter drafts, ordinary encounters and recruitment. All three abilities cost 1 Mana:

- **Resonant Leap:** Deal 4 Stun damage; Draw a card
- **Hush Dome:** Nullify the next harmful status effect on each ally
- **Lullaby Drift:** Restore 4 Health and Cleanse the most injured ally

**Encore** gives Chimecricket's first accepted ability each turn a 10%, 20%, 30%, 40%, 50% or 60% chance to repeat at zero through five stars. The complete ability repeats once for free, with no additional accepted-play XP or card count. Talent repeats and Encore together still produce at most one repeat. A failed roll spends that turn's opportunity; rejection does not. The receipt survives swaps and current-format saves and resets at the next turn or battle. Enemies use the 10% base tier. Repeats stop if the actor or attack target falls. Lullaby Drift reselects the most injured living deployed ally for each repetition, including Chimecricket, using Health percentage and battlefield order for ties; healing and full Cleanse affect that same recipient. Backup and knockouts are excluded.

Hush Dome gives each living deployed ally, including Chimecricket, one non-stacking Nullify protection. It remains until consumed or Purged, including across turns, swaps and resume. The next applicable Burn, Poison, Bleed, Stun, Freeze or Blind application consumes it without applying that status; direct damage still lands. Existing statuses remain. Dodge, fully blocked damage, periodic ticks and immune or already capped status applications do not consume it. Nullify precedes reflection and can stop reflected statuses. Repeated Hush Dome refreshes one protection rather than stacking charges. Enemy Hush Dome protects only living enemies. Save version 31 rejects obsolete development saves without migration.

The unchanged landscape portrait (`05.png`) and three portrait ability PNGs come from the user's [Chimecricket Drive folder](https://drive.google.com/drive/folders/1kAT543t5YDsXpU-an5j9XeROepKrKPeX). Each original file URL is recorded in the asset manifest. The shared preparation pipeline retains native 4:3 creature and 3:4 action compositions. Source artwork was visually inspected; in-game rendered review remains pending.
