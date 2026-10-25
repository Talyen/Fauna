# Parhelion

Parhelion is a 26-Health ordinary support creature, “The sun upon the snow”
The user selected Sunthaw and the three abilities below on October 25, 2026

| Ability          | Base rules                                           | Target                                                    |
| ---------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| Polar Reprieve   | Cleanse all Freeze build-up from allies; Draw 1 card | Living deployed allies                                    |
| Sundog Reservoir | Gain 2 Mana                                          | Shared player Mana                                        |
| Whiteout Waltz   | Deal 1 Freeze damage; Blind all enemies              | One chosen enemy for damage; all living enemies for Blind |

All abilities cost 1 Mana. [The kit](../../../src/game/content/creatures/parhelion.ts) uses the existing thaw, Mana and attack owners. This selection replaces earlier Light/Freeze damage and escape proposals; Threefold Escape and Polar Noon are not used

## Sunthaw

| Stars | Complete passive rule                       |
| ----- | ------------------------------------------- |
| 0     | Cleansing Freeze build-up restores 1 Health |
| 1     | Cleansing Freeze build-up restores 2 Health |
| 2     | Cleansing Freeze build-up restores 3 Health |
| 3     | Cleansing Freeze build-up restores 4 Health |
| 4     | Cleansing Freeze build-up restores 5 Health |
| 5     | Cleansing Freeze build-up restores 6 Health |

The creature whose buildup is cleansed receives the healing. Each living deployed Parhelion contributes its current tier to a friendly deployed recipient, including itself. Duplicate providers add their amounts; reserves and knocked-out providers contribute nothing. Enemy providers use their base tier, independently of the player's Collection rank

Any actual Freeze buildup Cleanse qualifies, including Polar Reprieve, Stillara's Thaw Path, ordinary Cleanse and Dodge's Unburdened. Clearing Stun, removing another harmful effect, an empty Cleanse, normal control recovery and battle setup grant nothing. Active Freeze is distinct from buildup: Polar Reprieve retains the existing buildup-only thaw behavior and does not release a Frozen creature. Removing active Freeze without buildup does not trigger Sunthaw

Healing follows ordinary received-healing modifiers, maximum Health and healing Boons, without revival, ability bounces or card-only overhealing rewards. Existing Renewal and Sin-Eater's Lantern rewards still resolve independently. Removal precedes healing, so another removal or a repeated Reprieve cannot heal the same buildup twice. No new saved counter or save-format change is needed; the existing species schema derives IDs from the catalog

The nearest overlap is Renewal's general Cleanse healing and Sin-Eater's Lantern. Sunthaw specializes in Freeze and supplies a friendly field effect through a creature slot, including when another creature provides the Cleanse. Its payoff is entirely conditional on enemies applying Freeze; it cannot heal arbitrary injuries on demand

## Artwork

The selected sources are unchanged PNGs from [Parhelion's Drive folder](https://drive.google.com/drive/folders/1Dk_ZU0a9p_GklN_EoJ3-qj13t-UDu5eU). The portrait shows an alert white hare under three suns, with blue mountain shadows and golden light on water. Warm footprints and flowers support Polar Reprieve's thaw and recovery; gathered solar ribbons support Sundog Reservoir; the brilliant snow wall supports Whiteout Waltz's Freeze and Blind

| Selection                  | Drive file                                                                       |
| -------------------------- | -------------------------------------------------------------------------------- |
| Portrait, Parhelion_03.png | [Source](https://drive.google.com/file/d/1qtZXFHXhxneEb1p6g4Y5XzoLjiV0v-yE/view) |
| Polar Reprieve             | [Source](https://drive.google.com/file/d/1thk0OksUyyGCE66qbP4mZaeaxCNjoH2G/view) |
| Sundog Reservoir           | [Source](https://drive.google.com/file/d/1qSczZBtr81b9c5S3iZ-PCWl2bU2PeOWJ/view) |
| Whiteout Waltz             | [Source](https://drive.google.com/file/d/1N88fNI9oAMGRrPjD8vXhmiWjw4qhsQKB/view) |

Originals live under `public/art/creatures/parhelion/`; the [asset manifest](../../../assets/manifest.json) owns provenance and prepared derivatives. The user's selection establishes the kit and source artwork choice, with rendered observations recorded separately

## Progression and play

Polar Reprieve trades immediate damage for group buildup removal and one fixed draw. It deliberately shares Thaw Path's existing behavior. Sunthaw adds one to six healing per affected ally. Repeated draws retain the ordinary hand/overflow rules; repeating a thaw does not recreate buildup

Reservoir pays one Mana and restores two, for a net gain of one when there is room under the Mana cap. Its primary value grows by two per ability level using the existing resource rules. It intentionally shares the established two-Mana baseline. Ordinary enemies have no shared Mana pool and cannot select Reservoir; enemy Reprieve omits the unsupported draw extra

Whiteout Waltz spends most of its budget on group Blind, with only one primary Freeze damage. Its damage grows by two per ability level; Blind remains fixed and uses its existing non-stacking, cleansing, reflection and protection rules. Room power scales enemy primary damage without increasing passive healing or utility counts

A normal opening uses Reservoir to fund allied plays, Whiteout to obscure incoming attacks, or Reprieve to clear accumulated Freeze and cycle a card. A satisfying recovery thaws two injured allies, heals both and draws another action. Without Freeze to remove, Reprieve still draws but grants no healing. Against fast damage, periodic effects or enemies that do not use Freeze, Parhelion relies on teammates to win and survive. It remains outside the first-run solo starter pool; appended ordinary encounter packs support recruitment without reordering existing packs

Values and comparisons are design estimates, not measured balance. Full lineup, advanced upgrade and talent/Boon combinations remain CI balance qualification

## Verification

[Focused regressions](../../../tests/unit/game/creatures/parhelion.test.ts) cover six tiers, actual removal, field ownership, duplicate providers, enemy tiers, repeats, Mana caps, damage/Blind targets, previews, save/resume and recruitment. [The shared review fixture](../../../tests/support/parhelion.ts) supplies all three cards, two injured allies with buildup and an injured ally without it

[Rendered evidence](../../task-evidence/parhelion.md) records Collection, inspection, battle and committed outcomes with platform boundaries
