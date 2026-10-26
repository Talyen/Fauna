# Cindernewt

[Creature index](README.md) · [Current kit](../../../src/game/content/creatures/cindernewt.ts) · [Authoring contracts](../../CONTENT.md)

Cindernewt is a creature eligible for starter drafts, ordinary encounters and recruitment. Cinderstep reads "When you Dodge, deal 1 Burn damage to the attacker" and scales from 1 through 6 damage at zero through five stars. Both ordinary Dodge and Blind misses trigger it. Its retaliation uses normal mitigation, Burn buildup and source attribution, cannot Dodge or critically hit, and cannot trigger attack retaliation or another Dodge. Periodic and derived damage do not trigger Cinderstep.

Cinder Lash selects Physical or Burn with equal probability using committed seeded randomness once per attack execution; repeats select again. Both authored damage categories participate in card XP, costs and card-level talent eligibility; resolved damage uses only the selected type. Follow the shared [preview and rejection contract](../../ARCHITECTURE.md#command-resolution-and-previews). Ember Breath melts surviving opponents' Armor after damage, even if they Dodged or blocked it. Five Armor loses three, and one loses one. Removing the last Armor triggers ordinary Armor-break passives; a knocked-out actor stops further effects. Ashen Veil applies Blind to surviving enemies after damage, including enemies that Dodged it. Enemy abilities use ordinary encounter damage scaling and affect deployed allies, excluding backup. Cindernewt uses the shared combat fields.

## Artwork provenance and validation record

Source: [Cindernewt Drive folder](https://drive.google.com/drive/folders/1MBRRJHBSdA-mKYA4SR2L7l5wYCIOlCG1). Portrait: `03.png`. Source inspected; rendered review was pending.
