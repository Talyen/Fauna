# Emberback

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Emberback is an armored brawler with 30 Health. Its unique passive, Molten Shell, reads: "When your Armor breaks, deal 1 Burn damage to all enemies" Damage scales from 1 through 6 at zero through five stars, replacing the previous tier. It grants no starting Armor. It appears in ordinary combat packs and becomes collectible through the existing recruitment flow.

Abilities:

- **Ember Charge:** Deal 4 Physical damage; Gain 2 Armor
- **Furnace Breath:** Deal 2 Burn damage to all enemies
- **Magma Stomp:** Deal 2 Stun damage to all enemies

Molten Shell triggers once per positive-to-zero Armor transition, after the effect that removes Armor completes. Damage, periodic damage, shattering, Purge and Armor theft can break Armor. No burst occurs while Armor remains, when Armor was already zero, or after the creature is knocked out. New Armor can enable another burst. Burn packets use existing mitigation and buildup, without Dodge, Critical hits or ordinary attack retaliation. Player bursts use the collected tier and hit living enemies; enemy bursts use the base tier and hit deployed living allies. Passives should typically have a unique species mechanic and concise rules without naming abilities.

## Artwork provenance and validation record

The selected creature portrait (`04.png`) and three ability portraits are copied unchanged from the user's [Emberback Drive folder](https://drive.google.com/drive/folders/1BAcTaOpKsPQonWJ4mZzJgRE3se0SrGp9) into `public/art/emberback/`. The manifest records each original file URL. Ability-specific artwork is used consistently in battle, inspection and Collection. Ashen Vanish remains outside the playable kit; its Drive source is preserved. PNG selections are copied at their original resolution and aspect ratio without cropping or conversion.
