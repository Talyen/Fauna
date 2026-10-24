import type { AbilityRuleCatalog } from "./contracts";
import { scalePower } from "./contracts";

export const protectionRules = {
  guard: {
    targeting: "guard",
    scaling: "power",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["block"],
    describe(card, { value }) {
      return card.target === "self" ? `Gain ${value} Block` : `Give an ally ${value} Block`;
    },
  },
  reflectAttack: {
    targeting: "self",
    scaling: "authored",
    enemy: "supported",
    adaptation: "extras",
    keywords: [],
    describe(_card) {
      return "Reflect the next attack";
    },
  },
  dreamDouble: {
    targeting: "self",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["nature"],
    describe(_card, { value }) {
      return `Gain ${value} Thorns / Negate the next attack against you`;
    },
  },
  waterThorns: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["water"],
    describe(_card, { value }) {
      return `Gain ${value} Water Thorns`;
    },
  },
  teamDodge: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["dodge"],
    describe(_card, { value }) {
      return `Give all allies ${value}% Dodge until your next turn`;
    },
  },
  dodge: {
    targeting: "self",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["dodge"],
    describe(_card, { value }) {
      return `Gain ${value}% Dodge until your next turn`;
    },
  },
  nullify: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: [],
    describe(_card) {
      return "Nullify the next harmful status effect on each ally";
    },
  },
  redistributeBlock: {
    targeting: "automatic",
    scaling: "power",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["block"],
    describe(_card, { value }) {
      return `Redistribute allied Block evenly; Allies gain ${value} Block`;
    },
  },
  teamGuard: {
    targeting: "automatic",
    scaling: "power",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["block"],
    describe(_card, { value }) {
      return `Allies gain ${value} Block`;
    },
  },
  teamProtection: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["block", "nature"],
    describe(_card, { value, power }) {
      return power === 1
        ? `Grant all allies ${value} Block or Thorns`
        : `Grant all allies ${scalePower(value, power)} Block or ${value} Thorns`;
    },
  },
} satisfies Pick<
  AbilityRuleCatalog,
  | "guard"
  | "teamGuard"
  | "redistributeBlock"
  | "teamProtection"
  | "reflectAttack"
  | "dreamDouble"
  | "waterThorns"
  | "teamDodge"
  | "dodge"
  | "nullify"
>;
