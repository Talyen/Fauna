# Pyrella

[Creature index](README.md) · [Authoring contracts](../../CONTENT.md)

Use the [authored kit](../../../src/game/content/creatures/pyrella.ts) for current values and complete tiers; [recorded selection values](../../archive/CREATURE_KIT_SELECTIONS.md#pyrella) preserve historical tuning.

Pyrella enters the ordinary encounter, recruitment and progressed draft pools. The first solo starter pool is unchanged. The selected kit was approved on October 25, 2026.

Every card costs 1 Mana. Festival Burst follows ordinary attack upgrades and room power. Ember Harvest refunds Mana before drawing and before automatic end turn; primary Mana upgrades add two per level while the Burn draw remains one. It follows hand/overflow, eligible living-owner, recycling and Mana caps. It grants Mana XP, while drawing a Burn card does not grant Burn XP. Enemies omit Ember Harvest and use their two supported cards. Spark Decoy adds two Fire Thorns per level, refreshes one non-stacking Negate and grants Burn XP. Negate and Fire Thorns use the shared [protection rules](../../KEYWORDS.md#thorns-and-water-thorns).

## Passing Flame

Passing Flame spreads a rank-dependent portion of a defeated Burning opponent's remaining Burn.

Only the Pyrella credited with the defeat triggers its passive, while alive and deployed. Direct damage, attributed periodic damage and Fire Thorns can qualify; a teammate's defeat does not. Enemy Pyrella uses the base tier. Death's Door must actually expire and Health reach zero before a roster creature counts as defeated. Multiple Pyrellas do not each trigger from another creature's kill.

Capture the victim's existing Burn at defeat, before a lethal hit adds its own buildup or a lethal periodic tick decays. Round the percentage pool once, divide it equally among surviving deployed creatures on the victim's side, including Minions, and assign indivisible remainder stacks in battlefield order. Six Burn at the six tiers produces total pools of 1, 2, 3, 4, 5 and 6. Full transfer conserves the pool; recipient caps can discard excess, and a protected recipient's portion is not reassigned. No surviving recipients means no spread or RNG draw.

Spreading applies Burn buildup without immediate damage. It retains Pyrella as its source, follows Nullify and harmful-status Reflection, and grants no extra card XP. Reflection can redirect a recipient's portion, without recursively reflecting it. No new passive counter or saved bookkeeping is needed. The current development save version requires the Fire Thorns field; obsolete saves are rejected without migration.

## Identity and balance

The portrait's cheerful red panda silhouette, warm petal tips and festival fireworks support carrying embers into another celebration. Compared with Wonder Domino, Passing Flame preserves remaining status buildup instead of distributing excess direct damage. Compared with Emberback, its trigger is a credited defeat rather than Armor depletion.

Festival Burst starts near six direct points against three enemies before its periodic Burn. Ember Harvest is a paid Mana refund plus focused draw, with no net base Mana gain. Spark Decoy combines persistent retaliation and one attack prevention, comparable to Reverie's Nature Thorns and Negate with Burn buildup as the material difference. These are budget comparisons, not measured balance results.

An opening can use Ember Harvest to find a Burn card, Festival Burst to ignite the opposing row and Spark Decoy to protect Pyrella while retaliating. A satisfying sequence defeats a Burning attacker through Fire Thorns and passes its embers onward. A weak draw of refunds and Decoys has limited immediate pressure. A solo opponent denies the spread payoff, while Cleanse, Nullify and Reflection can interrupt the chain.

## Artwork provenance

Source: [Pyrella Drive folder](https://drive.google.com/drive/folders/15CrVtC9zgMSZYieJjZJd3cCBGWbvsh7e). The selected original PNGs are preserved under `public/art/creatures/pyrella/` and registered in the [asset manifest](../../../assets/manifest.json):

- Portrait: `Pyrella_01.png`, Drive ID `1JPxrntSp3xOl7EAh3f-QeA3w1Qt0XSqp`
- Festival Burst: `Pyrella_Ability-Utility-01_FestivalBurst.png`, Drive ID `1S5rt1ZQWSeq6b0YOSRrp2JcUMEF6Wc0L`
- Ember Harvest: `Pyrella_Ability-Utility-02_EmberHarvest.png`, Drive ID `1tWwJGdixFry8L1xkwYjxuQtJne3w3sW7`
- Spark Decoy: `Pyrella_Ability-Expansion-01_SparkDecoy.png`, Drive ID `1QsahvRmVYOtXNXiCfsuB_aiZ4MCEx-n2`

The originals and all eight candidates were visually inspected during design. The user selected these three illustrations and mechanics on 2026-10-25. Prepared derivatives use the existing lossless card recipe and preserve the complete composition. Source selection is separate from rendered review and measured balance.

## Validation record

The [implementation and rendered review record](../../task-evidence/pyrella.md) retains focused regression results, viewport conditions, interaction readback and verification boundaries.
