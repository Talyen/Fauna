# Almanelle

Almanelle is a 28-Health ordinary support creature, “The orchard through the seasons”
The user selected Fallen Leaves, Rooted Year and Autumn Insight on October 23, 2026

| Ability        | Rules                                                                            | Target    |
| -------------- | -------------------------------------------------------------------------------- | --------- |
| Spring Current | Deal 4 Water damage; Cleanse acting creature: remove 1 effect                    | One enemy |
| Autumn Insight | Return a random discarded card to your hand; Restore 3 Health to an injured ally | One ally  |
| Rooted Year    | Gain 3 Block; Gain 3 Thorns                                                      | Self      |

All three cost 1 Mana. Autumn Insight uses the ordinary player-chosen ally targeting flow; recovery resolves before healing. A full-Health recipient can still receive the card's recovery utility, with healing capped normally

## Fallen Leaves

| Stars | Complete passive rule                |
| ----- | ------------------------------------ |
| 0     | 50% of decaying Block becomes Thorns |
| 1     | 60% of decaying Block becomes Thorns |
| 2     | 70% of decaying Block becomes Thorns |
| 3     | 80% of decaying Block becomes Thorns |
| 4     | 90% of decaying Block becomes Thorns |
| 5     | Decaying Block becomes Thorns        |

Almanelle keeps the normal retained half of its own Block, rounded normally. Fallen Leaves converts the Block actually lost during that turn decay into Thorns, also rounded normally. For example, 20 Block becomes 10 Block and grants 5, 6, 7, 8, 9 or 10 Thorns at the six tiers. Three Block becomes two Block and grants one Thorns at base rank; a single Block rounds back to one and loses nothing

The conversion runs at the existing turn boundary, after periodic damage and before the creature starts its action window. It also follows the ordinary Block decay of living reserves, including while controlled. Knocked-out creatures gain nothing. Block spent absorbing attacks, removed by another effect or moved between creatures does not trigger the passive

Only Almanelle converts its Block. Duplicate individuals act independently. Enemy Almanelle uses the base 50% tier regardless of the player's Collection rank or room power. Converted Thorns use the normal status cap and gain owner. No new saved counter, historical-card record or migration is needed; ordinary Block, Thorns and progression data preserve the state across save/resume

The nearest overlap is Mossguard's Block retention. Mossguard keeps more shelter; Almanelle keeps the ordinary amount and turns the lost portion into retaliation. Reedstag shares new protection and Coralcurl retaliates when Block breaks; neither converts turn decay. The rule introduces a choice between spending Block to survive now and banking enough to grow future Thorns, without a per-turn allowance or mandatory partner

## Artwork and identity

The [Drive source folder](https://drive.google.com/drive/folders/1AYTvxX-JPpkKdTdhdaAbthfkF6QKXkzr) contains a landscape portrait and three action paintings. The red panda has a large striped tail, dark legs, orchard blossoms and red fruit growing across its back. It stands above a cultivated alpine valley in warm daylight. Broad painted shapes, cream blossoms, rust fur, green foliage and blue mountains connect the set

The action sources show a clear water arc over a moving animal, a raised paw guiding autumn leaves, and flowering roots sheltering it from rain. The seasonal orchard identity interprets those visible actions. Spring Current uses the file named Winter Pause because the selected image depicts running water with no ice. No artwork was generated or edited

Unchanged PNG originals are preserved in `public/art/creatures/almanelle/`. The [manifest](../../../assets/manifest.json) records these exact Drive IDs, rights notes and lossless preparation recipes:

| Selection      | Drive file ID                       |
| -------------- | ----------------------------------- |
| Portrait       | `1c38i8eEKL_xx-Ge9KIOmVQd1SaZrPXAY` |
| Spring Current | `1F6ra5V0H2DGp7IjfKwMuc3Yb0zaEy7gQ` |
| Autumn Insight | `1vLezcKwd2AWYhEnNWkK7_LOpEns7t2XN` |
| Rooted Year    | `1HLZ6FCMzkYdhqhWQTplkq1Q_koT0Y9Zo` |

## Ability choices and budgets

- **Spring Current:** four damage points plus self-Cleanse utility. The wave removes one harmful category after the attack, including when the target Dodges. It trades two points from a plain six-damage Water attack for recovery. Riptide, Seafoam and ordinary Cleanse rewards can amplify it
- **Autumn Insight:** random discard recovery is provisionally worth three to four points of access, plus three healing points. This is a modest budget exception selected by the user, with random access and missing Health limiting its value. Recovery selects an eligible discarded card, including the just-played card, preserves identity and ownership, and uses the persistent buffer when the hand is full. Healing then goes to the selected living ally. It overlaps Cadenza's recovery and Bloomquail's draw/heal, but combines recycling with directed team recovery
- **Rooted Year:** three immediate Block plus three Thorns. Thorns can deal three, then two, then one Nature retaliation damage across three landed attacks, including attacks absorbed by Block, so their total value can exceed a simple three-damage estimate. Attacks that spend all Almanelle's Block leave no decay for Fallen Leaves; preserving Block supports both survival and future Thorns

Upgrades add two to Spring Current's primary damage and Rooted Year's primary Block per level. Rooted Year's three supplemental Thorns, Spring Current's one Cleanse and Autumn Insight's one recovery plus three healing remain fixed. Enemy room power scales primary damage, Block and adapted healing, without increasing utility counts, Thorns extras or the passive percentage

Ordinary enemies have no shared hand, so Autumn Insight adapts to three healing for a living ally, chosen by the existing most-injured enemy selection. Inspection uses the same adapted definition. All three abilities are usable by enemies. Appended normal encounter packs make Almanelle encounterable and recruitable without reordering existing entries. It is excluded from the first-run starter pool because one modest attack and two supports make solo openings slow

## Play and weakness

A normal opening uses Rooted Year to gain shelter and Thorns. Spring Current removes Almanelle's Burn and pressures an enemy, while Autumn Insight recovers a spent card and restores an injured companion. If Rooted Year's three Block survives to the next turn, two remain and Fallen Leaves adds one Thorns. Stacking or upgrading Block makes rank differences more visible

For a stronger setup, reach twenty Block through repeated Rooted Year or allied protection. Ten remain after decay, while Fallen Leaves grows five to ten Thorns. Upgraded Rooted Year, Water's Seafoam, Ironwood Buckler and allied Block cards can support this buildup; the passive supplies no free Mana or cards

Poor draws contain recovery without a useful discard or healing with no missing Health. Strong incoming attacks spend the stored Block before it can grow Thorns. Dodge prevents Thorns retaliation; fully absorbed attacks still trigger it. Periodic damage spends Block and does not trigger Thorns, and Purge can remove accumulated Thorns. Almanelle must survive an attack to retaliate. The complete kit and higher-rank sustain require hosted balance qualification; no measured win-rate claim is made

## Verification

[Almanelle's focused suite](../../../tests/unit/game/creatures/almanelle.test.ts) protects all six tiers, rounding, real turn ordering, reserve/knockout boundaries, caps, enemy use, authoritative previews, targeted recovery/healing, repeats, upgrades, save/resume and normal recruitment. [The review fixture](../../../tests/support/almanelle.ts) supplies a damaged party, Burn, all three cards and a recoverable discarded card

The [rendered review record](../../task-evidence/almanelle.md) retains source identity, evidence paths, exercised interactions and platform boundaries. Source inspection and passing asset hashes do not establish artistic acceptance, measured balance, native input or platform qualification
