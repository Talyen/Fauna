# Orifable design

The owner selected the following kit on October 23, 2026. This is the agreed design and proposed Food artwork; gameplay, neutral-card ownership and runtime artwork integration remain unimplemented. Food-pool expansion and artwork acceptance remain open.

## Express Delivery

At the start of each of its turns, Orifable has one chance to draw one additional card. The six total passive tiers are:

| Stars | Complete passive rule                      |
| ----- | ------------------------------------------ |
| 0     | 50% chance to draw an extra card each turn |
| 1     | 60% chance to draw an extra card each turn |
| 2     | 70% chance to draw an extra card each turn |
| 3     | 80% chance to draw an extra card each turn |
| 4     | 90% chance to draw an extra card each turn |
| 5     | Draw an extra card each turn               |

The chance applies once per turn, rather than once per card drawn. Rookhaven copies drawn cards; Express Delivery instead draws an additional existing card from the ordinary draw pile. Existing hand and overflow rules still apply. Player ranks use the selected tier and enemies use the base tier under the shared creature contract.

## Abilities

Every authored ability costs 1 Mana. These are the selected base effects; creature Health and ability upgrade behavior still need definition during implementation.

| Ability      | Rule                                      |
| ------------ | ----------------------------------------- |
| Care Package | Create two Food cards                     |
| Good Tidings | Restore 6 Health to the most injured ally |
| Postal Swarm | Deal 2 Physical damage to all enemies     |

Care Package selects each Food independently at random from the available Food pool, with duplicates possible, as selected by the owner. Created Food is temporary battle content and has no creature ownership; it must remain usable if Orifable leaves deployment or falls. Food effects and artwork are independent of the creating creature.

Good Tidings starts at the shared six-point single-target healing guideline. Postal Swarm starts at six total damage against three enemies. Care Package supplies access and choice but requires spending Mana on the generated Food; Mana Berries cost 1 Mana to gain 2, for a net gain of 1. These are provisional budget observations, not measured balance evidence.

## Food

Food cards cost 1 Mana and have Consume, which removes them after an accepted play under the existing [Consume contract](../../KEYWORDS.md#consume). They are not tied to a creature. The selected examples are:

| Food         | Rule                      | Proposed source artwork                               |
| ------------ | ------------------------- | ----------------------------------------------------- |
| Apple        | Restore 6 Health; Consume | [Apple](../../../design/food/apple.png)               |
| Mana Berries | Gain 2 Mana; Consume      | [Mana Berries](../../../design/food/mana-berries.png) |

Suggested third Food, awaiting the owner's choice: **Trail Bread — Gain 6 Block; Consume**. This adds protection alongside healing and Mana. It has not been added to the selected Food pool and no Bread artwork has been generated.

## Artwork

The [Orifable Drive collection](https://drive.google.com/drive/folders/1kAqpnhORlxqzn1PQyiRG3ybdgZwwMvgd) supplies the portrait and three corresponding ability illustrations:

- [Portrait](https://drive.google.com/file/d/1uRbVYn1LT6G_7gg65mN-zLsBFZZk4e3l/view)
- [Care Package](https://drive.google.com/file/d/10F-sy4aL0O3B3YWcF1hp4gqIRtErj3cp/view)
- [Good Tidings](https://drive.google.com/file/d/1skK3N1iwDHd5cCPcq4sJetkdJyPMcO_q/view)
- [Postal Swarm](https://drive.google.com/file/d/1AMG-3DWaEpNC0GXPq3GZ9jr4giX_hPC1/view)

The portrait depicts a raccoon courier crossing a stone bridge. Care Package opens into fruit and restorative provisions; Good Tidings releases warmth that revives flowers; Postal Swarm surrounds a stone pursuer with a distracting flock of letters. The selected effects follow those depicted actions.

[Food prompts and source-review scope](orifable-art-prompts.md) preserve the exact built-in ImageGen requests and style provenance. Proposed Food originals are design assets, not runtime manifest selections. Implementation must use the shared asset preparation and rendered-review procedure before visual integration.
