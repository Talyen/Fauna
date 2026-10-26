# Aerostat

[Creature index](README.md) · [Food execution](../../../src/game/combat/food.ts) · [Regressions](../../../tests/unit/game/creatures/aerostat.test.ts)

Use the [authored kit](../../../src/game/content/creatures/aerostat.ts) for current values and complete tiers; [recorded selection values](../../archive/CREATURE_KIT_SELECTIONS.md#aerostat) preserve historical tuning.

Aerostat is a traveling quartermaster. The owner selected its kit on October 25, 2026: travel packs and provisions establish its resource identity, with Voyager’s Rest providing a simple defensive option. Aerostat joins ordinary encounter packs, recruitment and collected starter drafts. Its support-only kit is excluded from the first-run starter pool.

## Well Provisioned

Each living, deployed Aerostat contributes its own tier at battle startup. Fallen or backup Aerostats contribute nothing. Supplies are independently chosen from Apple, Mana Berries and Trail Bread with equal probability; duplicates are possible. They enter the draw pile before its shuffle and ordinary opening draws, rather than being guaranteed in the opening hand. Startup uses the shared generation owner, deterministic RNG, neutral ownership, level-zero temporary cards and ordinary battle capacity. Supplies award no draw or creation XP and their creation does not trigger Well Read.

Well Provisioned supplies resources before any ability is drawn. This differs from Orifable’s extra turn-start draw and Rookhaven’s copies of actual draws. Resume, turns, swaps and recruitment during combat never replay the opening grant. Duplicate providers add their counts; existing supplies remain usable when a provider leaves or falls.

## Consume and battle lifecycle

All three [shared Food definitions](../../../src/game/content/food.ts) already have Consume. Playing one removes that card for the rest of the battle, after any accepted repeat resolves. It enters neither discard nor draw and cannot be recovered. Unplayed Food discards and recycles normally. Invalid or unaffordable plays preserve the card, state and RNG; previews are detached and resume preserves consumed cards’ absence.

Every new battle rebuilds the starting deck and replenishes the active providers’ complete tier counts. Used starting Food therefore does not disappear permanently or require repurchasing. Extra Food generated during combat remains battle-only; it does not accumulate across battles. The random Food types are selected anew at startup. No new persisted fields or save-format change are needed: the existing temporary neutral-card contract represents both starting and generated supplies, and battle cleanup removes them before the next opening.

## Abilities, enemies and balance

Voyager’s Rest targets Aerostat alone. True Bearing first draws, then removes Blind from every living deployed ally, including Aerostat and allied Minions; it leaves other harmful effects and backups unchanged. It remains usable when nobody is Blind. Blind removal uses the existing Cleanse owner and its ordinary rewards. The existing team-Blind-removal rule now supports a primary-value draw, leaving Tournelle’s Kindled Courage and its Light-card draw unchanged.

Parcel Drop uses the same Food generation and overflow rules as Orifable’s Care Package. Their shared description now says that Food enters the hand. Upgrades increase primary values by two per level: Voyager’s Rest gives 6/8/10/12 Block, True Bearing draws 2/4/6/8 cards and Parcel Drop creates 2/4/6/8 Food. Blind removal remains fixed, and Food itself does not upgrade.

Ordinary enemies have no hand or draw pile. Enemy Aerostat can use Voyager’s Rest and True Bearing’s allied Blind removal, but cannot draw or create Food; Well Provisioned has no enemy deck to supply. This preserves the existing ordinary-enemy resource boundary rather than adding a second deck model. Player passive rank does not amplify enemy behavior.

Voyager’s Rest follows the six-point Block baseline. Parcel Drop supplies choices that still cost Mana to use. True Bearing deliberately adds situational team Blind removal to the ordinary two-card draw baseline, as selected by the owner. These are budget observations, not measured balance results. A normal opening uses available supplies, draws useful teammate actions and saves Block for pressure. A satisfying sequence turns Mana Berries into another play, then finds more actions through True Bearing. A full hand of supplies can compete with attacks for Mana; a solo or depleted support roster cannot win through this kit’s direct damage.

## Selected artwork

The owner selected these ability illustrations from the [Aerostat Drive folder](https://drive.google.com/drive/folders/1MHRIhvQatC43T9A-pjxXoE2aotfS_aa2). Its sole portrait supplies the creature artwork. Unchanged originals are retained under `public/art/creatures/aerostat/` and registered in the [manifest](../../../assets/manifest.json).

| Use            | Original                                       | Drive source                                                                       |
| -------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Portrait       | `Aerostat_01.png`                              | [Original](https://drive.google.com/file/d/1X-PzTKAuLvbA3TWVCqcIwKB-fq2PmIip/view) |
| Voyager’s Rest | `Aerostat_Ability-Utility-04_VoyagersRest.png` | [Original](https://drive.google.com/file/d/1Fn5H6DydGDCJ_Q-y1nJ9tGvo-aDq-Kei/view) |
| True Bearing   | `Aerostat_Ability-Utility-02_TrueBearing.png`  | [Original](https://drive.google.com/file/d/1TDEiAbrOny7C9sDQuo5G-pSoQ69t_GVV/view) |
| Parcel Drop    | `Aerostat_Ability-Expansion-01_ParcelDrop.png` | [Original](https://drive.google.com/file/d/1-wi60sXxkABUNwlw3RdsbBC8z8Z7cVgn/view) |

The portrait uses 4:3 landscape framing and actions use 3:4 portrait framing through the shared lossless prepared-art pipeline. The pack-bearing silhouette, compass clearing dark clouds, sheltered rest and descending supply parcels retain one consistent blue/gold travel palette. [Implementation evidence](../../task-evidence/aerostat.md) records rendered conditions, exercised interactions and verification boundaries.
