import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";

export const orifable: CreatureKit = {
  species: {
    id: "orifable",
    name: "Orifable",
    title: "The bearer of good tidings",
    health: 26,
    color: "#d6a65e",
    trait: "Express Delivery",
    passiveTiers: sixPassiveTiers([50, 60, 70, 80, 90, 100], (amount) => ({
      description:
        amount === 100 ? "Draw an extra card each turn" : `${amount}% chance to draw an extra card each turn`,
      effects: [{ kind: "expressDelivery", amount }],
    })),
  },
  cards: [
    { ...card("orifable", "Care Package", "createFood", 2), artwork: "action.orifable.care-package" },
    {
      ...card("orifable", "Good Tidings", "heal", 6),
      target: "mostInjured",
      artwork: "action.orifable.good-tidings",
    },
    {
      ...attack("orifable", "Postal Swarm", 2, "physical"),
      target: "allEnemies",
      artwork: "action.orifable.postal-swarm",
    },
  ],
};
