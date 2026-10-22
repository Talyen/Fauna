import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const wickwaltz: CreatureKit = {
  species: {
    id: "wickwaltz",
    name: "Wickwaltz",
    title: "The kindling dancer",
    health: 28,
    color: "#c96d39",
    trait: "Kindling Flourish",
    passiveTiers: [
      {
        description: "Wickwaltz’s second card each turn has a 20% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 20 }],
      },
      {
        description: "Wickwaltz’s second card each turn has a 36% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 36 }],
      },
      {
        description: "Wickwaltz’s second card each turn has a 52% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 52 }],
      },
      {
        description: "Wickwaltz’s second card each turn has a 68% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 68 }],
      },
      {
        description: "Wickwaltz’s second card each turn has an 84% chance to repeat",
        effects: [{ kind: "kindlingFlourish", amount: 84 }],
      },
      {
        description: "Wickwaltz’s second card each turn repeats",
        effects: [{ kind: "kindlingFlourish", amount: 100 }],
      },
    ],
  },
  cards: [
    {
      ...attack("wickwaltz", "Ember Pirouette", 2, "burn"),
      target: "allEnemies",
      artwork: "action.wickwaltz.ember-pirouette",
    },
    {
      ...card("wickwaltz", "Saffron Screen", "guard", 3),
      target: "self",
      effects: [{ kind: "nullifyFreeze", amount: 1 }],
      artwork: "action.wickwaltz.saffron-screen",
    },
    {
      ...card("wickwaltz", "Thermal Rise", "draw", 2),
      effects: [{ kind: "mana", amount: 1 }],
      artwork: "action.wickwaltz.thermal-rise",
    },
  ],
};
