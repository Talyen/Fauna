import { freeze } from "immer";

// Parameters and their displayed values are authored together; execution stays in its named owner.
function boon<P extends object>(parameters: P, describe: (parameters: P) => string) {
  return { ...parameters, text: describe(parameters) };
}
const rules = freeze(
  {
    "geode-anvil": boon({}, () => "Block cannot decay below Armor"),
    "journey-loom": boon({}, () => "Returning an ally’s card to your hand draws another ally’s card"),
    "devotion-clasp": boon({}, () => "Negate also protects another ally from the same attack"),
    "prism-chisel": boon({}, () => "Purging enemy Armor deals equal Light damage to that enemy"),
    "eclipse-protractor": boon({}, () => "Critical Hits add Freeze build-up equal to the bonus damage"),
    "wonder-ball-maze": boon({}, () => "Excess Stun and Freeze build-up spreads to other enemies"),
    "sleepers-urn": boon({}, () => "Stun and Freeze build-up can accumulate during enemy immunity"),
    "facet-abacus": boon({ slots: 1 }, () => "Gain an additional hand card slot"),
    "thornheart-ring": boon({}, () => "Thorns does not decay when retaliating against Bleeding enemies"),
    "moonboat-toy": boon({}, () => "Water attacks do not trigger Thorns damage"),
    "pearl-sieve": boon({}, () => "Purge removes an extra effect from enemies with Block"),
    "tide-anklet": boon({}, () => "Swapping allies both keep the higher Block total"),
    "obsidian-pitcher": boon({ divisor: 2 }, () => "Overflow Leech applies half as much Burn to the enemy"),
    "molten-paperweight": boon({}, () => "Burn cannot be Cleansed from enemies with Block"),
    "coronation-cloche": boon({}, () => "Nullify protects allied effects from Purge"),
    "vigil-lantern": boon({}, () => "Allies at Death’s Door can act through Stun and Freeze"),
    "grain-flail": boon({}, () => "Breaking enemy Block also removes their Armor"),
    "gemmed-scabbard": boon({}, () => "Armor also reduces Thorns damage"),
    "dream-tangram": boon({}, () => "Repeated attacks move on when their target falls"),
    "comet-crucible": boon({}, () => "Armor Purged from allies becomes Block"),
    "grafting-needle": boon({ divisor: 2 }, () => "Healing an ally raises their Armor to half of yours"),
    "coral-net-weight": boon({}, () => "Dodged attacks still damage enemy Block"),
    "moonveil-mask": boon({}, () => "Enemies keep Blind when it causes their attacks to miss"),
    "mercury-metronome": boon(
      { buildup: 1 },
      () => "Playing cards from different allies in succession adds 1 Stun buildup to all enemies",
    ),
    "raincatcher-bowl": boon({ mana: 1 }, () => "Gain 1 Mana Crystal if you have a Water card in your deck"),
    "thunder-conch": boon({}, () => "Stunning an enemy Blinds the other enemies"),
    "thistle-sieve": boon(
      { divisor: 2 },
      () => "Half the Poison and Bleed Cleansed from allies becomes Thorns",
    ),
    "crater-punch": boon({ divisor: 2 }, () => "Critical Hits also deal half their blocked damage to Health"),
    "cloud-cup-and-ball": boon(
      {},
      () => "When an ally’s Block breaks, return one of their discarded cards to hand",
    ),
    "echo-lens": boon({ chance: 0.1 }, () => "Negate has a 10% chance to also Reflect"),
    "apiary-smoker": boon({}, () => "Blinded enemies cannot gain Thorns"),
    "brookskip-disc": boon({}, () => "Water damage against enemy Block chains to a second enemy"),
    "fallingstar-anvil": boon(
      { divisor: 2 },
      () => "Half the Block lost to enemy attacks becomes Stun buildup on the attacker",
    ),
    "pleated-pagoda": boon({ divisor: 2 }, () => "Half the Block lost through decay becomes Armor"),
    "calendula-soap": boon({}, () => "Cleansing an ally’s last harmful effect grants them Nullify"),
    "nectar-dipper": boon({ multiplier: 2 }, () => "Food cards are twice as effective"),
    "saddle-pouch": boon({}, () => "Swapping an ally in from backup draws one of its cards"),
    "dune-shuttle": boon({ block: 1 }, () => "Drawing an ally's card grants them 1 Block"),
    "story-puzzle-cube": boon(
      { effects: 3, purge: 1 },
      () => "Every third harmful effect you apply Purges the enemy",
    ),
    "mineral-bookend": boon({ mana: 1 }, () => "Drawing the last card in your draw pile restores 1 Mana"),
    "briar-racquet": boon({ divisor: 2 }, () => "Thorns retaliates at half strength when you Dodge"),
    "lovers-knot": boon({}, () => "Healing an ally also heals yourself"),
    "thaw-spoon": boon({}, () => "Healing removes an equal amount of Freeze buildup"),
    "cinder-fan": boon(
      {},
      () => "Enemy Burn lost through decay deals that much Burn damage, split between other enemies",
    ),
    "moss-oven-mitt": boon({ multiplier: 2 }, () => "Block is twice as effective against Burn"),
    "encore-baton": boon({ cards: 3, draw: 1 }, () => "Draw a card after playing three"),
    "pruning-crescent": boon({}, () => "Purging enemy Thorns steals them for yourself"),
    "knot-comb": boon({}, () => "Cleanse a random harmful effect each turn"),
    "rain-cape": boon({}, () => "Water damage does not remove allied Armor"),
    "tuning-fork-charm": boon({}, () => "Physical hits ignore Armor on enemies with Stun buildup"),
    rainkeeper: boon({ overflow: 2 }, () => "Mana can overflow"),
    "dream-yo-yo": boon({}, () => "Cards Dodged by enemies return to hand"),
    "basalt-glass-bookmark": boon({}, () => "Purge cannot remove an ally’s last beneficial effect"),
    "wonder-domino": boon({}, () => "Overkill damage spreads to other enemies"),
    "furnace-prism": boon({}, () => "Light hits Blind Burning enemies"),
    "last-threshold": boon({}, () => "Overflow Healing is shared with allies at Death's Door"),
    "camp-hammock": boon({}, () => "Backup allies can receive Healing"),
    "honeycomb-frame": boon({}, () => "Armor prevents Critical Hits"),
    "undertow-castanets": boon({}, () => "Stun and Freeze buildup combines on enemies"),
    "orbit-armillary": boon({}, () => "Cleansed effects return to their source"),
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
