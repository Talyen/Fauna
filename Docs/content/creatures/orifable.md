# Orifable and Food

[Kit](../../../src/game/content/creatures/orifable.ts) · [Shared Food definitions](../../../src/game/content/food.ts) · [Food execution](../../../src/game/combat/food.ts) · [Focused regressions](../../../tests/unit/game/creatures/orifable.test.ts)

Orifable is a 26-Health support creature, the bearer of good tidings. The owner selected its kit and all three Food cards on October 23, 2026. It appears in ordinary encounter packs and recruitment; it is excluded from the first-run starter pool. Once collected, it follows ordinary starter selection rules.

## Express Delivery

At the start of each player turn, including the opening turn, each living deployed Orifable gets one chance to draw an additional existing card after ordinary draws. The six complete passive tiers are:

| Stars | Complete passive rule                      |
| ----- | ------------------------------------------ |
| 0     | 50% chance to draw an extra card each turn |
| 1     | 60% chance to draw an extra card each turn |
| 2     | 70% chance to draw an extra card each turn |
| 3     | 80% chance to draw an extra card each turn |
| 4     | 90% chance to draw an extra card each turn |
| 5     | Draw an extra card each turn               |

The final tier requires no chance roll. Ordinary draws and Food creation do not retrigger delivery. Fallen and backup Orifables do not deliver; controlled deployed Orifables still provide their passive. Duplicate providers each get one delivery. Existing hand and overflow rules apply, and there is no extra delivery on resume or swapping in mid-turn.

Rookhaven copies a card when it is drawn; Express Delivery draws an existing card from the ordinary pile. Well Read can copy the extra draw, while Good Fortune can reroll a failed delivery through the existing chance owner.

## Abilities and progression

Every authored ability costs 1 Mana.

| Ability      | Base rule                                 |
| ------------ | ----------------------------------------- |
| Care Package | Add 2 Food to your hand                   |
| Good Tidings | Restore 6 Health to the most injured ally |
| Postal Swarm | Deal 2 Physical damage to all enemies     |

Care Package independently selects each Food from the three-entry pool with equal probability; duplicates are possible. Creation is not a draw. Generated cards enter the hand or persistent overflow, use the shared 256-card battle limit and receive unique temporary IDs. At capacity, no Food is created and no selection roll is spent. Orifable's ability upgrades use the existing +2 primary-value rule: Care Package creates 2/4/6/8 Food, Good Tidings restores 6/8/10/12 Health and Postal Swarm deals 2/4/6/8 Physical damage per enemy. Food itself stays at level zero.

Good Tidings starts at the six-point single-target healing guideline; injured means the lowest remaining Health proportion, with board-order ties, under the shared target owner. Postal Swarm starts near six total damage against three enemies and uses normal Dodge, Armor and critical-hit rules. Care Package supplies access and choice, then requires Mana to use its provisions. These are budget observations, not measured balance results.

Ordinary enemies retain the existing no-hand model. Their Orifable can use Good Tidings and Postal Swarm; Care Package is excluded by the explicit enemy-support contract. Express Delivery has no enemy hand to draw into. This follows the existing treatment of ordinary draw/recovery creatures and does not introduce a second enemy deck model.

## Shared Food

| Food         | Rule                      | Original artwork                                          |
| ------------ | ------------------------- | --------------------------------------------------------- |
| Apple        | Restore 6 Health; Consume | [Apple](../../../public/art/food/apple.png)               |
| Mana Berries | Gain 2 Mana; Consume      | [Mana Berries](../../../public/art/food/mana-berries.png) |
| Trail Bread  | Gain 6 Block; Consume     | [Trail Bread](../../../public/art/food/trail-bread.png)   |

Food costs 1 Mana, has no species or creature owner, and lasts only for the battle. Apple and Trail Bread use ordinary living-ally targeting, including allied Minions; Mana Berries resolve immediately into shared Mana. A Berry therefore gains one net Mana before the shared cap. Escape cancels targeting without consuming Food or Mana.

Food survives its creator falling, swapping out, or a Legendary formation change. It remains drawable and recoverable, and Well Read copies retain neutral ownership. Unplayed Food discards and recycles normally. An accepted play Consumes the played card after resolution; a pending Dancing Double resolves its effects twice before that single consumption. Rejection preserves the card and RNG. Preview uses the same resolution on detached state.

Food does not spend creature free-card charges, use creature-specific ability repeats or increment an acting creature's card counters. It remains usable while creatures are controlled; general team accepted-play effects, keyword XP, recipient modifiers, talents and Boons retain their ordinary rules. Neutral cards are represented explicitly in the save schema; only supported, temporary, level-zero Food can have no owner. Food was introduced with save format 56; the current [save format](../../../src/game/save-format.json) rejects obsolete development saves rather than migrating them.

## Play pattern

Care Package opens choices: use Mana Berries to extend a useful turn, feed an injured ally with an Apple, or protect someone with Trail Bread. Good Tidings supplies reliable recovery without finding Food first, while Postal Swarm gives a weak or full-Health opening a useful attack. Express Delivery improves access to the mixed team deck. Orifable is vulnerable to pressure that outpaces its healing, and Food can crowd the hand or cost more Mana than the current turn can spare.

## Artwork and evidence

The [Orifable Drive collection](https://drive.google.com/drive/folders/1kAqpnhORlxqzn1PQyiRG3ybdgZwwMvgd) supplies unchanged originals:

- [Portrait](https://drive.google.com/file/d/1uRbVYn1LT6G_7gg65mN-zLsBFZZk4e3l/view): a raccoon courier crossing a stone bridge
- [Care Package](https://drive.google.com/file/d/10F-sy4aL0O3B3YWcF1hp4gqIRtErj3cp/view): fruit and restorative provisions
- [Good Tidings](https://drive.google.com/file/d/1skK3N1iwDHd5cCPcq4sJetkdJyPMcO_q/view): warm letter-light revives flowers
- [Postal Swarm](https://drive.google.com/file/d/1AMG-3DWaEpNC0GXPq3GZ9jr4giX_hPC1/view): a flock of letters obstructs a stone pursuer

[Food prompts](orifable-art-prompts.md) preserve the built-in ImageGen requests and original style provenance. Original sources live under `public/art/`; [the manifest](../../../assets/manifest.json) registers all seven images and the standard lossless prepared-art recipe. Source inspection and generated art do not establish artistic approval. Focused regression, browser-rendered evidence and full CI/platform qualification are separate outcomes.

[Implementation verification](../../task-evidence/orifable-food.md) records the observed checks, rendered conditions, live player interactions and unrun platform gates.
