# Cindernewt

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Cindernewt is a 24 Health creature eligible for starter drafts, ordinary encounters and recruitment. Cinderstep reads "When you Dodge, deal 1 Burn damage to the attacker" and scales from 1 through 6 damage at zero through five stars. Enemies use the base tier. Both ordinary Dodge and Blind misses trigger it. Its retaliation uses normal mitigation, Burn buildup and source attribution, cannot Dodge or critically hit, and cannot trigger attack retaliation or another Dodge. Periodic and derived damage do not trigger Cinderstep.

All three abilities cost 1 Mana:

- **Cinder Lash:** Deal 6 Physical or Burn damage at random
- **Ember Breath:** Deal 1 Burn damage to all enemies; Remove 50% of all enemies’ Armor, rounded up
- **Ashen Veil:** Deal 1 Burn damage to all enemies; Blind all enemies

Cinder Lash selects Physical or Burn with equal probability using committed seeded randomness once per attack execution; repeats select again. Both authored damage categories participate in card XP, costs and card-level talent eligibility; resolved damage uses only the selected type. Previews use detached RNG and rejected commands consume none. Ember Breath melts surviving opponents' Armor after damage, even if they Dodged or blocked it. Five Armor loses three, and one loses one. Removing the last Armor triggers ordinary Armor-break passives; a knocked-out actor stops further effects. Ashen Veil applies Blind to surviving enemies after damage, including enemies that Dodged it. Enemy abilities use ordinary encounter damage scaling and affect deployed allies, excluding backup. The current save format rejects obsolete development saves without migration; Cindernewt uses the shared combat fields.

## Artwork provenance and validation record

These retained notes record source selection and verification at implementation time; they do not establish current rendered acceptance

The unchanged landscape portrait (`03.png`) and three action PNGs come from the user's [Cindernewt Drive folder](https://drive.google.com/drive/folders/1MBRRJHBSdA-mKYA4SR2L7l5wYCIOlCG1). Each original file URL is recorded in the asset manifest; native 4:3 creature and 3:4 action compositions are retained. Source artwork was visually inspected; in-game rendered review remains pending.
