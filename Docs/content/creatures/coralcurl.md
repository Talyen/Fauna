# Coralcurl and Water

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Coralcurl has 28 Health and is available through ordinary encounters, recruitment and starter drafts. Its abilities:

- **Bubble Ward:** Gain 6 Block
- **Reef Jet:** Deal 6 Water damage
- **Coral Spiral:** Swap out for a random backup; Blind all enemies

**Bubbleburst** reads "Deal 1 Water damage when your Block breaks" at zero stars and scales to 2, 3, 4, 5 and 6. When a direct attack spends the last Block, a surviving Coralcurl damages the living attacker, including an exactly absorbed attack. The captured break still triggers if another reward restores Block. Purge, expiry, periodic damage and retaliation do not trigger it; Bubbleburst cannot chain retaliation.

Coral Spiral follows [ordinary swap rules](../../EXPEDITION_DESIGN.md#knockout-replacement-and-ability-swaps), then Blinds every living enemy, including when alone without backup. Enemy Spiral exchanges battlefield positions and Blinds deployed allies.

[Keywords](../../KEYWORDS.md#combat-rules) owns Water mitigation and [XP classification](../../KEYWORDS.md#classification-and-progression); its blue token is distinct from Mana, Block and Freeze. The six [Water talents](../../../src/game/content/talents/water.ts) form three rows. Their hit rewards include fully absorbed hits, exclude Dodges and require a surviving actor; passive damage cannot activate them.

## Artwork provenance and validation record

Source: [Coralcurl Drive folder](https://drive.google.com/drive/folders/19NVnBIdFleyfmnqCTyg4GeSiQkMbI2TE). Water talent art reuses Reef Jet; Water uses generic impact audio. Source inspected; rendered gameplay and balance acceptance were pending.
