# Skybex

[Creature index](README.md) · [Implementation](../../../src/game/content/creatures/skybex.ts) · [Content contracts](../../CONTENT.md)

Skybex has 26 Health. Its mountain paths, cloud stepping stones and sweeping horns support movement, protection and Nature damage. It joins ordinary encounters, recruitment and collected starter drafts. It is excluded from the first-run solo pool because Cloudstep and Mountain Guide need another creature.

## Selected kit

Every ability costs 1 Mana:

- **Far Horizon:** Draw 2 cards
- **Cloudstep:** Swap out for a random ally / Incoming ally gains 20% Dodge until next turn
- **Sky Shepherd:** Deal 2 Nature damage to all enemies

**Mountain Guide:** Allies gain X Block when they swap in

| Stars | Block |
| ----- | ----- |
| 0     | 1     |
| 1     | 2     |
| 2     | 3     |
| 3     | 4     |
| 4     | 5     |
| 5     | 6     |

Each row replaces the previous passive. Ability upgrades remain separate: Far Horizon's draw count, Cloudstep's Dodge percentage and Sky Shepherd's damage gain the ordinary two points per level. Enemy room power affects Nature damage, not Dodge or passive tiers. Ordinary enemies use Cloudstep and Sky Shepherd; Far Horizon remains unavailable because they do not have a player draw pile.

## Swap ownership

The shared [team owner](../../../src/game/team.ts) grants Mountain Guide on ability swaps, deployed position swaps and knockout replacements. A living guide present immediately before or after the swap contributes its own tier, so Skybex can lead its replacement out of backup or protect its own arrival. Other inactive backups and fallen guides contribute nothing. Multiple guides grant Block independently through the ordinary grant owner, retaining conversion, sharing, caps and Boon reactions. Control does not turn off this automatic passive. Opening deployment, recruitment and resume do not replay swap grants.

Cloudstep uses the existing swap selection: prefer a random living backup; with no living backup, exchange positions with a random other living deployed ally. The creature entering Skybex's former position receives the Dodge. No available partner means no swap and no grant. The swap owner returns that actual recipient; the ability never infers it from card slots or mutable ownership. Temporary Dodge follows the existing cap, Purge and expiry rules, including backup turns, skipped turns and save/resume.

A repeated Cloudstep can swap again while its actor remains deployed. An actor already moved to backup cannot swap again or spend additional RNG. Existing swap abilities share that validity check. A legal play still pays once and awards Dodge XP once. Sky Shepherd awards Nature XP, and its attacks use ordinary Dodge, Critical hits, Block and damage reactions. No saved counters or format change are needed.

## Play and balance

Far Horizon finds more options; Sky Shepherd provides immediate group pressure; Cloudstep brings in another creature with Block and Dodge. Mountain Guide also supports other creatures' swap abilities and protects knockout replacements. Its distinct relationship is protection on arrival, rather than Sternshell's battle-opening Armor or Reedstag's sharing of new Block.

Without a backup, Cloudstep can still exchange deployed positions. With no living partner, it has no benefit. Skybex cannot heal existing injuries; pressure from damage over time and a depleted roster remain meaningful weaknesses. Draw and group damage follow existing ability budgets; swap protection and duplicate-guide stacking need measured balance evidence before any win-rate claim.

## Artwork provenance

Selected by the user on October 25, 2026 from the [Skybex Drive folder](https://drive.google.com/drive/folders/1idImi9bO0hHFU1FrU-s5uKvyW2xPHhy9):

| Use          | Original                                      | Drive source                                                                       |
| ------------ | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Portrait     | `skybex_02.png`                               | [Original](https://drive.google.com/file/d/1wqwVGx9SjPLUFBukcBOx9Ew_cbSd2dBl/view) |
| Far Horizon  | `Skybex_Ability-Utility-04_FarHorizon.png`    | [Original](https://drive.google.com/file/d/1pc6Cqq3LkFNAiWLUY2o7zGmfACyIsLjO/view) |
| Cloudstep    | `Skybex_Ability-Utility-01_Cloudstep.png`     | [Original](https://drive.google.com/file/d/1W5WK3vAlYaCsm6aIbsdcvjF4oMK7buTI/view) |
| Sky Shepherd | `Skybex_Ability-Expansion-02_SkyShepherd.png` | [Original](https://drive.google.com/file/d/1v59fZy8YS-MJuzoZGUcFaphkYlKc-fmg/view) |

Unchanged PNG originals are retained under `public/art/creatures/skybex/`; the manifest registers the portrait at 4:3 and actions at 3:4 through the lossless prepared-art pipeline. Unselected illustrations are excluded from production. [Implementation evidence](../../task-evidence/skybex.md) records local validation and remaining gates.
