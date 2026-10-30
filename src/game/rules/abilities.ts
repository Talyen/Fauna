import { freeze } from "immer";
import type { AbilityKind } from "./ability-types";
import type { AbilityRule, AbilityRuleCatalog } from "./contracts";
import { scalePower } from "./contracts";

/** Structured pilot for one complete rule; values and keyword identity never come from parsing prose. */
export function guardSelfRule(value: number): {
  source: string;
  template: string;
  values: { value0: string };
  keywords: { keyword0: "block" };
} {
  return {
    source: `Gain ${value} Block`,
    template: "Gain {{value0}} <keyword0>Block</keyword0>",
    values: { value0: String(value) },
    keywords: { keyword0: "block" },
  };
}

// Ordinary support abilities scale with card level and are usable by either side.
// Every kind still supplies its own description and can override these shared policies.
const automatic = {
  targeting: "automatic",
  scaling: "level",
  enemy: "supported",
  adaptation: "extras",
  keywords: [],
} as const satisfies Omit<AbilityRule, "describe">;

const rules: AbilityRuleCatalog = freeze(
  {
    reflectAlly: {
      ...automatic,
      targeting: "ally",
      scaling: "authored",
      describe: () => "Reflect the next attack against an ally",
    },
    moonlitWaltz: {
      ...automatic,
      targeting: "self",
      keywords: ["dodge", "freeze"],
      describe: (_card, { value }) =>
        `Gain ${value}% Dodge until your next turn / Retaliate with 3 Freeze damage when you Dodge`,
    },
    stealEffect: {
      ...automatic,
      targeting: "enemy",
      scaling: "authored",
      keywords: ["light"],
      describe: () => "Purge an enemy / Steal the effect purged",
    },
    borrowBackup: {
      ...automatic,
      scaling: "authored",
      enemy: "unsupported",
      keywords: ["mana"],
      describe: () => "Draw a copy of a random backup ally ability / Gain 1 Mana",
    },
    raincall: {
      ...automatic,
      scaling: "authored",
      keywords: ["health"],
      describe: () => "Draw a Water card / Cleanse Burn from allies",
    },
    swapThorns: {
      ...automatic,
      keywords: ["nature"],
      describe: (_card, { value }) => `Swap out for a random backup / Incoming ally gains ${value} Thorns`,
    },
    springbound: {
      ...automatic,
      keywords: ["health", "dodge"],
      describe: (_card, { value }) =>
        `Cleanse all Freeze build-up from allies / Gain ${value}% Dodge until next turn`,
    },
    heal: {
      ...automatic,
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
      ...automatic,
      targeting: "ally",
      scaling: "authored",
      keywords: ["health"],
      describe: (_card) => "Resurrect an ally",
    },
    nightmareHarvest: {
      ...automatic,
      scaling: "authored",
      keywords: ["health", "mana"],
      describe: (_card, { value }) => `Cleanse all allies / Gain ${value} Mana per effect removed`,
    },
    teamClearBlind: {
      ...automatic,
      keywords: ["health"],
      describe: (card, { value }) =>
        card.draw ? `Draw ${value} cards / Cleanse Blind from allies` : "Cleanse allies Blind",
    },
    teamThaw: {
      ...automatic,
      keywords: ["health"],
      describe: (_card) => "Cleanse all Freeze build-up from allies",
    },
    teamCleanse: {
      ...automatic,
      keywords: ["health"],
      describe: (_card, { value }) =>
        `Cleanse ${value} harmful effect${value === 1 ? "" : "s"} from all allies`,
    },
    repeatNextCard: {
      ...automatic,
      scaling: "authored",
      describe: (_card) => "Your next card is played twice",
    },
    gildedWard: {
      ...automatic,
      scaling: "power",
      keywords: ["health"],
      describe: (_card, { value }) =>
        `Restore ${value} Health to all allies / Summon 2 Gilded Wards with 4 Health`,
    },
    royalRepose: {
      ...automatic,
      scaling: "power",
      keywords: ["health", "block"],
      describe: (_card, { value, power }) =>
        `Restore ${value} Health / Give all allies ${scalePower(1, power)} Block`,
    },
    meadowDecree: {
      ...automatic,
      keywords: ["health"],
      describe: (_card, { value, power }) =>
        `Summon a Royal Bloom with ${value} Health / Restore ${scalePower(2, power)} Health to all allies`,
    },
    procession: {
      ...automatic,
      keywords: ["health"],
      describe: (_card) => "Summon an Echo / Restore your Minions to full Health",
    },
    teamNegate: {
      ...automatic,
      scaling: "authored",
      describe: () => "Give all allies Negate",
    },
    bridgeRewind: {
      ...automatic,
      scaling: "power",
      keywords: ["health"],
      describe: (_card, { value }) => `Restore ${value} Health; restore a broken Pendulum`,
    },
    createBees: {
      ...automatic,
      scaling: "authored",
      describe: (_card, { value }) => `Add ${value} Clockwork Bees to your hand`,
    },
    armorAlly: {
      ...automatic,
      targeting: "ally",
      scaling: "power",
      keywords: ["armor"],
      describe: (_card, { value }) => `Give an ally ${value} Armor`,
    },
    createFood: {
      ...automatic,
      enemy: "unsupported",
      describe: (_card, { value }) => `Add ${value} Food to your hand`,
    },
    createPearls: {
      ...automatic,
      keywords: ["mana", "block"],
      describe: (_card, { value }) => `Create ${value} Pearls`,
    },
    pearl: {
      ...automatic,
      keywords: ["mana", "block"],
      describe: (_card, { value, power }) =>
        `Gain ${scalePower(value, power)} Block or ${value} Mana at random`,
    },
    recover: {
      ...automatic,
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
      ...automatic,
      enemy: "unsupported",
      keywords: ["mana"],
      describe: (card, { value }) => `${card.restore ? "Restore" : "Gain"} ${value} Mana`,
    },
    draw: {
      ...automatic,
      enemy: "legendaryDraw",
      adaptation: "healingExtra",
      describe: (_card, { value }) => `Draw ${value} card${value === 1 ? "" : "s"}`,
    },
    redraw: {
      ...automatic,
      enemy: "unsupported",
      describe: (_card) => "Shuffle your hand into your deck; Draw that many cards",
    },
    guard: {
      ...automatic,
      targeting: "guard",
      scaling: "power",
      keywords: ["block"],
      describe(card, { value }) {
        return card.target === "allAllies"
          ? card.id === "selvage-nest-ward"
            ? `Give all allies ${value} Block`
            : `Allies gain ${value} Block`
          : card.target === "self"
            ? `Gain ${value} Block`
            : `Give an ally ${value} Block`;
      },
    },
    reflectAttack: {
      ...automatic,
      targeting: "self",
      scaling: "authored",
      describe: (_card) => "Reflect the next attack",
    },
    dreamDouble: {
      ...automatic,
      targeting: "self",
      keywords: ["nature"],
      describe: (_card, { value }) => `Gain ${value} Thorns / Negate the next attack against you`,
    },
    sparkDecoy: {
      ...automatic,
      targeting: "self",
      keywords: ["burn"],
      describe: (_card, { value }) => `Apply ${value} Burn to all enemies / Gain Negate`,
    },
    dodge: {
      ...automatic,
      targeting: "self",
      keywords: ["dodge"],
      describe(card, { value }) {
        return card.target === "allAllies"
          ? `Give all allies ${value}% Dodge until your next turn`
          : `Gain ${value}% Dodge until your next turn`;
      },
    },
    nullify: {
      ...automatic,
      describe: (_card) => "Nullify the next harmful status effect on each ally",
    },
    redistributeBlock: {
      ...automatic,
      scaling: "power",
      keywords: ["block"],
      describe: (_card, { value }) => `Redistribute allied Block evenly; Allies gain ${value} Block`,
    },
    teamProtection: {
      ...automatic,
      keywords: ["block", "nature"],
      describe(_card, { value, power }) {
        return power === 1
          ? `Grant all allies ${value} Block or Thorns`
          : `Grant all allies ${scalePower(value, power)} Block or ${value} Thorns`;
      },
    },
    swapChosen: {
      ...automatic,
      targeting: "ally",
      scaling: "authored",
      enemy: "unsupported",
      describe: () => "Swap out for a chosen backup",
    },
    swapDodge: {
      ...automatic,
      keywords: ["dodge"],
      describe: (_card, { value }) =>
        `Swap out for a random ally / Incoming ally gains ${value}% Dodge until next turn`,
    },
    teamBlind: {
      ...automatic,
      describe: (_card) => "Blind all enemies",
    },
    swapLowest: {
      ...automatic,
      enemy: "unsupported",
      describe: (_card) => "Swap out the lowest Health ally",
    },
    teamPurge: {
      ...automatic,
      keywords: ["light"],
      describe: (_card) => "Purge all enemies",
    },
    swap: {
      ...automatic,
      describe: (_card) => "Swap out for a random backup",
    },
    attack: {
      ...automatic,
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
  },
  true,
);

export function abilityRule<K extends AbilityKind>(kind: K): AbilityRule<K> {
  return rules[kind];
}
export function isAbilityKind(kind: string): kind is AbilityKind {
  return Object.hasOwn(rules, kind);
}
