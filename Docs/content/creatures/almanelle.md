# Almanelle

Use the [authored kit](../../../src/game/content/creatures/almanelle.ts) for current values and complete tiers.

Almanelle is an ordinary support creature, “The orchard through the seasons”

All three abilities cost 1 Mana. Autumn Insight uses the ordinary player-chosen ally targeting flow; recovery resolves before healing. A full-Health recipient can still receive the card's recovery utility, with healing capped normally

## Fallen Leaves

Almanelle keeps the normal retained half of its own Block, rounded normally. Fallen Leaves converts the Block actually lost during that turn decay into Thorns, also rounded normally. A single Block rounds back to one and loses nothing

The conversion runs at the existing turn boundary, after periodic damage and before the creature starts its action window. It also follows the ordinary Block decay of living reserves, including while controlled. Knocked-out creatures gain nothing. Block spent absorbing attacks, removed by another effect or moved between creatures does not trigger the passive

Only Almanelle converts its Block. Duplicate individuals act independently. Enemy Almanelle uses the base 50% tier regardless of the player's Collection rank or room power. Converted Thorns use the normal status cap and gain owner. Ordinary Block, Thorns and progression data preserve the state across save/resume

The nearest overlap is Mossguard's Block retention. Mossguard keeps more shelter; Almanelle keeps the ordinary amount and turns the lost portion into retaliation. Reedstag shares new protection and Coralcurl retaliates when Block breaks; neither converts turn decay. The rule introduces a choice between spending Block to survive now and banking enough to grow future Thorns, without a per-turn allowance or mandatory partner

## Artwork and identity

The [Drive source folder](https://drive.google.com/drive/folders/1AYTvxX-JPpkKdTdhdaAbthfkF6QKXkzr) contains a landscape portrait and three action paintings. The red panda has a large striped tail, dark legs, orchard blossoms and red fruit growing across its back. It stands above a cultivated alpine valley in warm daylight. Broad painted shapes, cream blossoms, rust fur, green foliage and blue mountains connect the set

The action sources show a clear water arc over a moving animal, a raised paw guiding autumn leaves, and flowering roots sheltering it from rain. The seasonal orchard identity interprets those visible actions. Spring Current uses the file named Winter Pause because the selected image depicts running water with no ice. No artwork was generated or edited

Unchanged originals are preserved in `public/art/creatures/almanelle/`; the [manifest](../../../assets/manifest.json) records their Drive IDs, rights and preparation recipes.

## Ability choices and budgets

- **Spring Current:** four damage points plus self-Cleanse utility. The wave removes one harmful category after the attack, including when the target Dodges. It trades two points from a plain six-damage Water attack for recovery. Riptide, Seafoam and ordinary Cleanse rewards can amplify it
- **Autumn Insight:** random discard recovery is provisionally worth three to four points of access, plus three healing points. This is a modest budget exception selected by the user, with random access and missing Health limiting its value. Recovery selects an eligible discarded card, including the just-played card, preserves identity and ownership, and uses the persistent buffer when the hand is full. Healing then goes to the selected living ally. It overlaps Cadenza's recovery and Bloomquail's draw/heal, but combines recycling with directed team recovery
- **Rooted Year:** three immediate Block plus three Thorns. Thorns can deal three, then two, then one Nature retaliation damage across three landed attacks, including attacks absorbed by Block, so their total value can exceed a simple three-damage estimate. Attacks that spend all Almanelle's Block leave no decay for Fallen Leaves; preserving Block supports both survival and future Thorns

Upgrades add two to Spring Current's primary damage and Rooted Year's primary Block per level. Rooted Year's three supplemental Thorns, Spring Current's one Cleanse and Autumn Insight's one recovery plus three healing remain fixed. Enemy room power scales primary damage, Block and adapted healing, without increasing utility counts, Thorns extras or the passive percentage

Ordinary enemies have no shared hand, so Autumn Insight adapts to three healing for a living ally, chosen by the existing most-injured enemy selection. All three abilities are usable by enemies. Appended normal encounter packs make Almanelle encounterable and recruitable without reordering existing entries. It is excluded from the first-run starter pool because one modest attack and two supports make solo openings slow

## Play and weakness

Almanelle converts Block lost to ordinary decay into future retaliation. Strong attacks can spend Block before it decays, while Dodge, periodic damage and Purge can limit Thorns. Recovery is weaker without a useful discard or missing Health; the kit's high-rank sustain still needs measured balance review.
