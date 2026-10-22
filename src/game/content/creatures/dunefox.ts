import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const dunefox: CreatureKit = {
  species: {
    id: "dunefox",
    name: "Dunefox",
    title: "The shifting mirage",
    health: 24,
    color: "#d9aa57",
    trait: "Shifting Sands",
    passiveTiers: [
      { description: "Allies gain 15% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 15 }] },
      { description: "Allies gain 20% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 20 }] },
      { description: "Allies gain 25% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 25 }] },
      { description: "Allies gain 30% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 30 }] },
      { description: "Allies gain 35% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 35 }] },
      { description: "Allies gain 40% of your Dodge chance", effects: [{ kind: "shareDodge", amount: 40 }] },
    ],
  },
  cards: [
    {
      ...attack("dunefox", "Sandburst Pounce", 6, "physical"),
      artwork: "action.dunefox.sandburst-pounce",
    },
    {
      ...attack("dunefox", "Dune Whirl", 1, "physical"),
      id: "dunefox-dune-whirl",
      target: "allEnemies",
      effects: [{ kind: "blind", amount: 1 }],
      artwork: "action.dunefox.dune-whirl",
    },
    {
      ...card("dunefox", "Mirage Step", "dodge", 30),
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.dunefox.mirage-step",
    },
  ],
};
