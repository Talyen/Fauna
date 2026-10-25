import type { AbilityRuleCatalog } from "./contracts";
import { scalePower } from "./contracts";

export const resourcesRules = {
  repeatNextCard: {
    targeting: "automatic",
    scaling: "authored",
    enemy: "supported",
    adaptation: "extras",
    keywords: [],
    describe(_card) {
      return "Your next card is played twice";
    },
  },
  procession: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["health"],
    describe(_card) {
      return "Summon an Echo / Restore your Minions to full Health";
    },
  },
  createFood: {
    targeting: "automatic",
    scaling: "level",
    enemy: "unsupported",
    adaptation: "extras",
    keywords: [],
    describe(_card, { value }) {
      return `Create ${value} Food cards`;
    },
  },
  createPearls: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["mana", "block"],
    describe(_card, { value }) {
      return `Create ${value} Pearls`;
    },
  },
  pearl: {
    targeting: "automatic",
    scaling: "level",
    enemy: "supported",
    adaptation: "extras",
    keywords: ["mana", "block"],
    describe(_card, { value, power }) {
      return `Gain ${scalePower(value, power)} Block or ${value} Mana at random`;
    },
  },
  recover: {
    targeting: "recover",
    scaling: "level",
    enemy: "unsupported",
    adaptation: "healingExtra",
    keywords: [],
    describe(card) {
      return card.target === "ally"
        ? "Return a random discarded card to your hand"
        : "Return a random discarded card from a living ally to your hand";
    },
  },
  mana: {
    targeting: "automatic",
    scaling: "level",
    enemy: "unsupported",
    adaptation: "extras",
    keywords: ["mana"],
    describe(card, { value }) {
      return `${card.restore ? "Restore" : "Gain"} ${value} Mana`;
    },
  },
  draw: {
    targeting: "automatic",
    scaling: "level",
    enemy: "legendaryDraw",
    adaptation: "healingExtra",
    keywords: [],
    describe(_card, { value }) {
      return `Draw ${value} card${value === 1 ? "" : "s"}`;
    },
  },
  redraw: {
    targeting: "automatic",
    scaling: "level",
    enemy: "unsupported",
    adaptation: "extras",
    keywords: [],
    describe(_card) {
      return "Shuffle your hand into your deck; Draw that many cards";
    },
  },
} satisfies Pick<
  AbilityRuleCatalog,
  | "repeatNextCard"
  | "procession"
  | "createFood"
  | "createPearls"
  | "pearl"
  | "draw"
  | "recover"
  | "redraw"
  | "mana"
>;
