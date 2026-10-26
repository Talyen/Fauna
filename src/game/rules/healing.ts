import type { AbilityRuleCatalog } from "./contracts";

export const healingRules = {
  springbound: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["health", "dodge"],
    describe(_card, { value }) {
      return `Cleanse all Freeze build-up from allies / Gain ${value}% Dodge until next turn`;
    },
  },
  heal: {
    targeting: "heal",
    scaling: "power",
    enemy: "supported",
    adaptation: "extras",
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
    enemy: "supported",
    adaptation: "extras",
    keywords: ["health"],
    describe(_card) {
      return "Resurrect an ally";
    },
  },
  nightmareHarvest: {
    targeting: "automatic",
    scaling: "authored",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["health", "mana"],
    describe(_card, { value }) {
      return `Cleanse all allies / Gain ${value} Mana per effect removed`;
    },
  },
  teamClearBlind: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["health"],
    describe(card, { value }) {
      return card.draw ? `Draw ${value} cards / Cleanse Blind from allies` : "Cleanse allies Blind";
    },
  },
  teamThaw: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["health"],
    describe(_card) {
      return "Cleanse all Freeze build-up from allies";
    },
  },
  teamCleanse: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["health"],
    describe(_card, { value }) {
      return `Cleanse ${value} harmful effect${value === 1 ? "" : "s"} from all allies`;
    },
  },
} satisfies Pick<
  AbilityRuleCatalog,
  "springbound" | "heal" | "resurrect" | "nightmareHarvest" | "teamCleanse" | "teamThaw" | "teamClearBlind"
>;
