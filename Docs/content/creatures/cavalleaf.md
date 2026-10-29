# Cavalleaf

The owner selected Wild Path, Meadow Return, Raincall and Prairie Leap on October 28, 2026. The [authored kit](../../../src/game/content/creatures/cavalleaf.ts) owns Health, exact rules and all six passive tiers. Cavalleaf is an ordinary recruitable creature outside the first-run starter pool

## Wild Path

When any living ally actually restores Health in battle, each living deployed Cavalleaf on that side gives the recipient its current passive amount as Thorns. This includes self-healing, Leech, ordinary passive healing and healing a living backup; it requires no credited healer. The player uses Collection rank and enemies use the base tier. Full Health and restoration of zero grant nothing. Resurrect is not healing. No new saved state is required

Thorns grants use the existing cap, sharing and Boon reactions. Grove's Favor independently grants an additional Thorns on allied healing. Rootspool can turn Thorns retaliation into healing that triggers Wild Path; retaliation does not cause another retaliation. Cavalleaf contributes only while living and deployed

## Abilities

Meadow Return restores the primary amount to living allies through the ordinary group healing owner. Camp Hammock can extend its recipients to living backups. Its primary value upgrades and scales with enemy power

Raincall draws one Water card from the ordinary eligible draw pile, then selectively Cleanses Burn from living deployed allies. Empty draws and absent Burn leave the other effect intact. Ordinary enemies have no deck from which to draw; they retain the Burn Cleanse. Draw count and Burn removal do not upgrade

Prairie Leap swaps Cavalleaf for a seeded random living backup and gives that incoming creature the primary amount of Thorns after ordinary swap reactions. Without a living backup the card is unavailable and a rejected play preserves Mana, formation and RNG. Ordinary enemies have no backup and cannot usefully exchange. A repeated play cannot swap an actor already in backup. The Thorns amount upgrades normally

## Artwork and evidence

The [Drive collection](https://drive.google.com/drive/folders/11G-8_ikc9eE13gnQyE_nSlIG_zAVrFvq) supplies the selected [portrait](https://drive.google.com/file/d/1KBEBqne0jHUe8iKN3Vh-LYP7nN0h2OSF/view), [Meadow Return](https://drive.google.com/file/d/16VZCLwUwouJxf8RTKz7iT55KmF_wBm9U/view), [Raincall](https://drive.google.com/file/d/1Rw3glFE2tVF5B_QI96Ql-h03p11mTdJt/view) and [Prairie Leap](https://drive.google.com/file/d/1wjlWJepzFSk7YK43ztFD8N5_Q91wo_bx/view). Unchanged originals are retained in `public/art/creatures/cavalleaf/` and registered with provenance in the [asset manifest](../../../assets/manifest.json)

[Focused regressions](../../../tests/unit/game/creatures/cavalleaf.test.ts) cover healing triggers and tiers, selective Cleanse, Backup exchange, previews and save/resume. Measured balance, hosted CI and platform qualification are separate
