import { freeze } from "immer";

// Parameters and their displayed values are authored together; execution stays in its named owner.
function boon<P extends object>(parameters: P, describe: (parameters: P) => string) {
  return { ...parameters, text: describe(parameters) };
}
const rules = freeze(
  {
    "tattered-pages": boon({ draw: 1 }, (p) => `Draw ${p.draw} additional card at battle start`),
    "bone-charm": boon({ healing: 3 }, (p) => `Restore ${p.healing} Health when you defeat an enemy`),
    "ironwood-buckler": boon({ thorns: 1 }, (p) => `Gain ${p.thorns} Thorns whenever you gain Block`),
    "icy-heart": boon({ damage: 6 }, (p) => `Freezing an enemy deals ${p.damage} Physical damage`),
    meteorite: boon({ multiplier: 2 }, (p) =>
      p.multiplier === 2
        ? "Double your first Burn hit each battle"
        : `Multiply your first Burn hit each battle by ${p.multiplier}`,
    ),
    "sin-eaters-lantern": boon(
      { healing: 6 },
      (p) => `Restore ${p.healing} Health per harmful effect you Cleanse`,
    ),
    thunderstone: boon({ damage: 6 }, (p) => `Deal ${p.damage} Nature damage when you Stun an enemy`),
    "groves-favor": boon({ thorns: 1 }, (p) => `Gain ${p.thorns} Thorns when you restore Health in battle`),
    "brass-censer": boon(
      { chance: 0.2, burnChance: 0.5 },
      (p) => `Light hits have a ${p.chance * 100}% chance to also Burn or Leech`,
    ),
    "parasitic-bloom": boon({ chance: 0.1 }, (p) => `Poison damage has a ${p.chance * 100}% chance to Leech`),
    "cutpurse-knife": boon({ gold: 1 }, (p) => `Gain ${p.gold} Gold when you deal Bleed damage`),
    "merchants-favor": boon(
      { discount: 7 },
      (p) => `Your purchase at each Boon Merchant costs ${p.discount} less Gold`,
    ),
    "plague-doctors-mask": boon(
      { removed: 2, divisor: 2 },
      (p) =>
        `Before turn-start damage, each ally Cleanses up to ${p.removed} Poison and deals ${p.divisor === 2 ? "half" : `1/${p.divisor}`} the amount removed as Poison damage to the first living enemy`,
    ),
    "sundering-charm": boon(
      { armor: 2 },
      (p) => `Your Physical and Stun hits remove ${p.armor} enemy Armor before damage`,
    ),
    "resonant-chimes": boon(
      { cards: 3, mana: 1 },
      (p) => `After your ${p.cards === 3 ? "third" : `${p.cards}th`} card each turn, gain ${p.mana} Mana`,
    ),
    "smugglers-map": boon({ gold: 2 }, (p) => `Gain ${p.gold} additional Gold for each battle won`),
    "frozen-pocketwatch": boon({ turns: 1 }, (p) => `Enemies stay Frozen for ${p.turns} additional turn`),
    "lucky-clover": boon(
      { chance: 0.1 },
      (p) => `Nature hits have a ${p.chance * 100}% chance to grant Gold equal to enemy Health lost`,
    ),
  },
  true,
);
export function boonRule<K extends keyof typeof rules>(id: K): (typeof rules)[K] {
  return rules[id];
}

// Living Chorus needs two cards; Resonant Chimes owns the later trigger.
export const PLAYER_CARD_TRIGGER_LIMIT = Math.max(2, boonRule("resonant-chimes").cards);
