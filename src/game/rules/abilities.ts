import { freeze } from "immer";
import type { AbilityKind } from "./ability-types";
import { scalePower, type AbilityRule, type AbilityRuleCatalog } from "./contracts";

type AuthoredRules = {
  [K in AbilityKind]: Pick<AbilityRule<K>, "describe"> & Partial<Omit<AbilityRule<K>, "describe">>;
};

const definitions = {
  springbound: {
    keywords: ["health", "dodge"],
    describe: (_card, { value }) =>
      `Cleanse all Freeze build-up from allies / Gain ${value}% Dodge until next turn`,
  },
  heal: {
    targeting: "heal",
    scaling: "power",
    keywords: ["health"],
    describe(card, { value }) {
      return card.target === "self"
        ? `Restore ${value} Health`
        : `Restore ${value} Health to ${card.target === "allAllies" ? "all allies" : card.target === "mostInjured" ? "the most injured ally" : card.target === "injured" ? "an injured ally" : "a living ally"}`;
    },
  },
  resurrect: {
    targeting: "ally",
    scaling: "authored",
    keywords: ["health"],
    describe: (_card) => "Resurrect an ally",
  },
  nightmareHarvest: {
    scaling: "authored",
    keywords: ["health", "mana"],
    describe: (_card, { value }) => `Cleanse all allies / Gain ${value} Mana per effect removed`,
  },
  teamClearBlind: {
    keywords: ["health"],
    describe: (card, { value }) =>
      card.draw ? `Draw ${value} cards / Cleanse Blind from allies` : "Cleanse allies Blind",
  },
  teamThaw: {
    keywords: ["health"],
    describe: (_card) => "Cleanse all Freeze build-up from allies",
  },
  teamCleanse: {
    keywords: ["health"],
    describe: (_card, { value }) =>
      `Cleanse ${value} harmful effect${value === 1 ? "" : "s"} from all allies`,
  },
  repeatNextCard: {
    scaling: "authored",
    describe: (_card) => "Your next card is played twice",
  },
  procession: {
    keywords: ["health"],
    describe: (_card) => "Summon an Echo / Restore your Minions to full Health",
  },
  createFood: {
    enemy: "unsupported",
    describe: (_card, { value }) => `Add ${value} Food to your hand`,
  },
  createPearls: {
    keywords: ["mana", "block"],
    describe: (_card, { value }) => `Create ${value} Pearls`,
  },
  pearl: {
    keywords: ["mana", "block"],
    describe: (_card, { value, power }) =>
      `Gain ${scalePower(value, power)} Block or ${value} Mana at random`,
  },
  recover: {
    targeting: "recover",
    enemy: "unsupported",
    adaptation: "healingExtra",
    describe(card) {
      if (card.allyOnly) return "Draw an ally’s card from your Discard pile";
      return card.target === "ally"
        ? "Return a random discarded card to your hand"
        : "Return a random discarded card from a living ally to your hand";
    },
  },
  mana: {
    enemy: "unsupported",
    keywords: ["mana"],
    describe: (card, { value }) => `${card.restore ? "Restore" : "Gain"} ${value} Mana`,
  },
  draw: {
    enemy: "legendaryDraw",
    adaptation: "healingExtra",
    describe: (_card, { value }) => `Draw ${value} card${value === 1 ? "" : "s"}`,
  },
  redraw: {
    enemy: "unsupported",
    describe: (_card) => "Shuffle your hand into your deck; Draw that many cards",
  },
  guard: {
    targeting: "guard",
    scaling: "power",
    keywords: ["block"],
    describe(card, { value }) {
      return card.target === "allAllies"
        ? `Allies gain ${value} Block`
        : card.target === "self"
          ? `Gain ${value} Block`
          : `Give an ally ${value} Block`;
    },
  },
  reflectAttack: {
    targeting: "self",
    scaling: "authored",
    describe: (_card) => "Reflect the next attack",
  },
  dreamDouble: {
    targeting: "self",
    keywords: ["nature"],
    describe: (_card, { value }) => `Gain ${value} Thorns / Negate the next attack against you`,
  },
  sparkDecoy: {
    targeting: "self",
    keywords: ["burn"],
    describe: (_card, { value }) => `Gain ${value} Fire Thorns / Gain Negate`,
  },
  waterThorns: {
    keywords: ["water"],
    describe: (_card, { value }) => `Gain ${value} Water Thorns`,
  },
  dodge: {
    targeting: "self",
    keywords: ["dodge"],
    describe(card, { value }) {
      return card.target === "allAllies"
        ? `Give all allies ${value}% Dodge until your next turn`
        : `Gain ${value}% Dodge until your next turn`;
    },
  },
  nullify: {
    describe: (_card) => "Nullify the next harmful status effect on each ally",
  },
  redistributeBlock: {
    scaling: "power",
    keywords: ["block"],
    describe: (_card, { value }) => `Redistribute allied Block evenly; Allies gain ${value} Block`,
  },
  teamProtection: {
    keywords: ["block", "nature"],
    describe(_card, { value, power }) {
      return power === 1
        ? `Grant all allies ${value} Block or Thorns`
        : `Grant all allies ${scalePower(value, power)} Block or ${value} Thorns`;
    },
  },
  swapChosen: {
    targeting: "ally",
    scaling: "authored",
    enemy: "unsupported",
    describe: () => "Swap out for a chosen backup",
  },
  swapDodge: {
    keywords: ["dodge"],
    describe: (_card, { value }) =>
      `Swap out for a random ally / Incoming ally gains ${value}% Dodge until next turn`,
  },
  teamBlind: {
    describe: (_card) => "Blind all enemies",
  },
  swapLowest: {
    enemy: "unsupported",
    describe: (_card) => "Swap out the lowest Health ally",
  },
  teamPurge: {
    keywords: ["light"],
    describe: (_card) => "Purge all enemies",
  },
  swap: {
    describe: (_card) => "Swap out for a random backup",
  },
  attack: {
    targeting: "attack",
    scaling: "power",
    describe(card, { value, level, power, label }) {
      let text: string;
      // Keep the conditional rule at its base value so resolved previews do not imply a second doubling
      if (card.doubleWithArmor || card.doubleAgainstHealthier)
        value = scalePower(card.value + level * 2, power);
      text = `Deal ${value} ${label(card.damageType)}${card.alternateDamageType ? ` or ${label(card.alternateDamageType)}` : ""} damage${card.alternateDamageType ? " at random" : ""}${card.target === "allEnemies" ? " to all enemies" : card.target === "randomEnemy" ? " to a random enemy" : ""}`;
      if (card.purgeThorns) text = `Purge enemy Thorns; ${text}`;
      if (card.doubleAgainstHealthier) text += " / Doubled against enemies with more Health than you";
      if (card.doubleWithArmor) text += "; Doubled if you have Armor";
      if (card.criticalWhenLastCard) text += " / If this is the last card in your hand, it Critically Hits";
      return text;
    },
  },
} satisfies AuthoredRules;

// Complete the common policies once; lookups share immutable rules without allocating.
const rules = freeze(
  Object.fromEntries(
    Object.entries(definitions).map(([kind, definition]) => [
      kind,
      {
        targeting: "automatic",
        scaling: "level",
        enemy: "supported",
        adaptation: "extras",
        keywords: [],
        ...definition,
      },
    ]),
  ) as AbilityRuleCatalog,
  true,
);

export function abilityRule<K extends AbilityKind>(kind: K): AbilityRule<K> {
  return rules[kind];
}
export function isAbilityKind(kind: string): kind is AbilityKind {
  return Object.hasOwn(rules, kind);
}
