import type { AbilityRuleCatalog } from "./contracts";

export const utilityRules = {
  teamBlind: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: [],
    describe(_card) {
      return "Blind all enemies";
    },
  },
  swapLowest: {
    targeting: "automatic",
    scaling: "level",
    enemy: "unsupported",
    adaptation: "extras",
    keywords: [],
    describe(_card) {
      return "Swap out the lowest Health ally";
    },
  },
  teamPurge: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["light"],
    describe(_card) {
      return "Purge all enemies";
    },
  },
  swap: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: [],
    describe(_card) {
      return "Swap out for a random backup";
    },
  },
} satisfies Pick<AbilityRuleCatalog, "teamBlind" | "teamPurge" | "swap" | "swapLowest">;
