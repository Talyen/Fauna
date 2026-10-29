# Velouria

The user selected Rimewake, Moonlit Waltz, Velvet Aegis and Hushed Finale on October 29, 2026. The [kit](../../../src/game/content/creatures/velouria.ts) owns Health, values and all six passive tiers. Velouria is an ordinary recruitable creature outside the starter pool

## Rimewake

When living, deployed Velouria actually gains temporary Dodge, it deals the tier amount of Freeze damage to each living opponent in battlefield order. The damage builds Freeze through ordinary status defenses, cannot Dodge or critically hit, and does not trigger attack reactions. Each actual grant resolves separately, including a partial gain at the temporary-Dodge cap; a grant that adds nothing does not trigger it. Enemy Velouria uses the base tier. Backup Velouria does not trigger the passive

## Abilities

Moonlit Waltz grants temporary Dodge and a fixed 3 Freeze retaliation for each eligible Dodge against an attacker. The retaliation and temporary Dodge expire together at the owner's next turn, including in backup or on a skipped turn; Purge of Dodge also removes the retaliation. Replaying Waltz refreshes the retaliation rather than stacking it. The retaliation uses the ordinary status retaliation rules and cannot trigger another retaliation

Velvet Aegis grants the chosen living ally the existing non-stacking Attack Reflection protection. Hushed Finale selects a random living enemy and uses ordinary Freeze attack resolution; repeats keep that target unless an explicit modifier redirects them

## Artwork and evidence

The selected portrait and v2 ability illustrations are preserved in the repository and identified in the [asset manifest](../../../assets/manifest.json). [Drive folder](https://drive.google.com/drive/folders/18PpXGPdC490kzIFzcAxJVleGAH5njBfq). Rendered review, measured balance, hosted CI and platform qualification are separate from source selection
