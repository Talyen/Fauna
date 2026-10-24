import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([20, 36, 52, 68, 84, 100], (amount) => ({
      description:
        amount === 100
          ? "Wickwaltz’s second card each turn repeats"
          : `Wickwaltz’s second card each turn has ${amount === 84 ? "an" : "a"} ${amount}% chance to repeat`,
      effects: [{ kind: "kindlingFlourish", amount }],
    })),
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
