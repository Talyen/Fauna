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
    passiveTiers: [
      {
        description: "50% chance to draw an extra card each turn",
        effects: [{ kind: "expressDelivery", amount: 50 }],
      },
      {
        description: "60% chance to draw an extra card each turn",
        effects: [{ kind: "expressDelivery", amount: 60 }],
      },
      {
        description: "70% chance to draw an extra card each turn",
        effects: [{ kind: "expressDelivery", amount: 70 }],
      },
      {
        description: "80% chance to draw an extra card each turn",
        effects: [{ kind: "expressDelivery", amount: 80 }],
      },
      {
        description: "90% chance to draw an extra card each turn",
        effects: [{ kind: "expressDelivery", amount: 90 }],
      },
      { description: "Draw an extra card each turn", effects: [{ kind: "expressDelivery", amount: 100 }] },
    ],
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
