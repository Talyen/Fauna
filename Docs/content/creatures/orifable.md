# Orifable and Food

[Shared Food definitions](../../../src/game/content/food.ts) · [Food execution](../../../src/game/combat/food.ts) · [Focused regressions](../../../tests/unit/game/creatures/orifable.test.ts)

Use the [authored kit](../../../src/game/content/creatures/orifable.ts) for current values and complete tiers; [recorded selection values](../../archive/CREATURE_KIT_SELECTIONS.md#orifable) preserve historical tuning.

Orifable is a support creature, the bearer of good tidings. The owner selected its kit and all three Food cards on October 23, 2026. It appears in ordinary encounter packs and recruitment; it is excluded from the first-run starter pool. Once collected, it follows ordinary starter selection rules.

## Express Delivery

At the start of each player turn, including the opening turn, each living deployed Orifable gets one chance to draw an additional existing card after ordinary draws. Its chance scales with permanent rank.

The final tier requires no chance roll. Ordinary draws and Food creation do not retrigger delivery. Fallen and backup Orifables do not deliver; controlled deployed Orifables still provide their passive. Duplicate providers each get one delivery. Existing hand and overflow rules apply, and there is no extra delivery on resume or swapping in mid-turn.

Rookhaven copies a card when it is drawn; Express Delivery draws an existing card from the ordinary pile. Well Read can copy the extra draw, while Good Fortune can reroll a failed delivery through the existing chance owner.

## Abilities and progression

Care Package independently selects each Food from the three-entry pool with equal probability; duplicates are possible. Creation is not a draw. Generated cards enter the hand or persistent overflow, use the shared 256-card battle limit and receive unique temporary IDs. At capacity, no Food is created and no selection roll is spent. Ordinary primary-value upgrades increase Food count, healing and damage. Food itself stays at level zero.

Good Tidings starts at the six-point single-target healing guideline; injured means the lowest remaining Health proportion, with board-order ties, under the shared target owner. Postal Swarm starts near six total damage against three enemies and uses normal Dodge, Armor and critical-hit rules. Care Package supplies access and choice, then requires Mana to use its provisions. These are budget observations, not measured balance results.

Ordinary enemies retain the existing no-hand model. Their Orifable can use Good Tidings and Postal Swarm; Care Package is excluded by the explicit enemy-support contract. Express Delivery has no enemy hand to draw into. This follows the existing treatment of ordinary draw/recovery creatures and does not introduce a second enemy deck model.

## Shared Food

The [shared Food contract](../../CONTENT.md#shared-food-cards) owns targeting, neutral ownership, consumption, copies, repeats and save validation for every provider. Current Food values and artwork IDs live in the [definitions](../../../src/game/content/food.ts); [generation prompts](orifable-art-prompts.md) retain artwork provenance. Orifable's selected Care Package creates access to that common pool without owning its cards.

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
