# Selvage

[Creature index](README.md) · [Kit](../../../src/game/content/creatures/selvage.ts) · [Mending targets](../../../src/game/mending.ts) · [Focused regressions](../../../tests/unit/game/creatures/selvage.test.ts)

Selvage is a songbird restoring overlooked things. Its [Drive folder](https://drive.google.com/drive/folders/1cl2P6cOfmj-MMLdX34VL2hY1zwSMo5T2) supplies the portrait and selected Gust Wing, Nest Ward and Mending Song illustrations. Original PNGs and source IDs are retained in the manifest.

## Mend the Broken

Selvage's healing abilities can revive a knocked-out roster ally with up to 2, 3, 4, 5, 6 or 7 Health at zero through five stars. Revival restores the lesser of the ability's primary healing value and the tier cap, capped by the target's maximum Health. It uses the ordinary resurrection lifecycle, including resurrection Boons, restored summons and no renewed Death's Door. It does not trigger ordinary healing rewards. The passive belongs to the living deployed acting creature, not a borrowed card's original owner; enemies use the base tier.

Mending Song ordinarily restores 6 Health to the most injured ally. While a fallen ally is available, the player chooses between that automatic living recipient and eligible knocked-out roster allies, including backups. The choice uses normal Mana, targeting, preview, rejection and save boundaries. Forced replacement remains required before playing a card. Enemy Selvage can consider a fallen enemy ally or its normal automatic healing target.

Gust Wing deals 2 Physical damage to all enemies. Nest Ward gives all allies 2 Block. Both follow existing group targeting and ability-level scaling. All three abilities cost 1 Mana. Selvage has 26 Health and enters the ordinary encounter and recruitment pool, not the fixed first-run starter pool.

The kit can attack or guard on a full-Health opening; a revived ally returns vulnerable, and a party under sustained pressure can struggle to create a safe turn for revival. The passive differs from Oathara's use of fallen allies' cards and existing direct Resurrect abilities by making an ordinary healing play a choice between living and fallen recipients. Balance and platform verification are separate from implementation.
