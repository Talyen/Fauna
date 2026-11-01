# Aerostat

[Creature index](README.md) · [Food execution](../../../src/game/combat/food.ts) · [Regressions](../../../tests/unit/game/creatures/aerostat.test.ts)

Use the [authored kit](../../../src/game/content/creatures/aerostat.ts) for current values and complete tiers.

Aerostat is a traveling quartermaster. Travel packs and provisions establish its resource identity, with Voyager’s Rest providing a simple defensive option. Aerostat joins ordinary encounter packs, recruitment and collected starter drafts. Its support-only kit is excluded from the first-run starter pool.

## Well Provisioned

Each living, deployed Aerostat contributes its own tier at battle startup. Fallen or backup Aerostats contribute nothing. Supplies are independently chosen from Apple, Mana Berries and Trail Bread with equal probability; duplicates are possible. They enter the draw pile before its shuffle and ordinary opening draws, rather than being guaranteed in the opening hand. Startup uses the shared generation owner, deterministic RNG, neutral ownership, level-zero temporary cards and ordinary battle capacity. Supplies award no draw or creation XP and their creation does not trigger Well Read.

Well Provisioned supplies resources before any ability is drawn. This differs from Orifable’s extra turn-start draw and Rookhaven’s copies of actual draws. Resume, turns, swaps and recruitment during combat never replay the opening grant. Duplicate providers add their counts; existing supplies remain usable when a provider leaves or falls.

## Food lifecycle

The shared [Food contract](../../CONTENT.md#shared-food-cards) owns consumption, overflow and persistence. Each battle supplies fresh Food; unused supplies remain usable after a provider leaves or falls, and combat-generated Food does not accumulate between battles.

## Abilities, enemies and balance

Voyager’s Rest targets Aerostat alone. True Bearing first draws, then removes Blind from every living deployed ally, including Aerostat and allied Minions; it leaves other harmful effects and backups unchanged. It remains usable when nobody is Blind. Blind removal uses the existing Cleanse owner and its ordinary rewards.

Parcel Drop uses the same Food generation and overflow rules as Orifable’s Care Package. Blind removal remains fixed, and Food itself does not upgrade.

Ordinary enemies have no hand or draw pile. Enemy Aerostat can use Voyager’s Rest and True Bearing’s allied Blind removal, but cannot draw or create Food; Well Provisioned has no enemy deck to supply. This preserves the existing ordinary-enemy resource boundary rather than adding a second deck model. Player passive rank does not amplify enemy behavior.

Voyager’s Rest follows the six-point Block baseline. Parcel Drop supplies choices that still cost Mana to use. True Bearing deliberately adds situational team Blind removal to the ordinary two-card draw baseline, as selected by the owner. These are budget observations, not measured balance results. A normal opening uses available supplies, draws useful teammate actions and saves Block for pressure. A satisfying sequence turns Mana Berries into another play, then finds more actions through True Bearing. A full hand of supplies can compete with attacks for Mana; a solo or depleted support roster cannot win through this kit’s direct damage.

## Selected artwork

The [Aerostat Drive folder](https://drive.google.com/drive/folders/1MHRIhvQatC43T9A-pjxXoE2aotfS_aa2) supplies the selected actions and sole portrait. Unchanged originals are retained under `public/art/creatures/aerostat/` and identified in the [manifest](../../../assets/manifest.json).

The portrait uses 4:3 landscape framing and actions use 3:4 portrait framing through the shared lossless prepared-art pipeline. The pack-bearing silhouette, compass clearing dark clouds, sheltered rest and descending supply parcels retain one consistent blue/gold travel palette.
