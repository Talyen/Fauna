import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const euphera: CreatureKit = {
  species: {
    id: "euphera",
    name: "Euphera",
    title: "A wish taking flight",
    health: 26,
    color: "#e7bd79",
    trait: "Good Fortune",
    passiveTiers: [
      {
        description: "Failed allied chance effects have a 10% chance to reroll once",
        effects: [{ kind: "goodFortune", amount: 10 }],
      },
      {
        description: "Failed allied chance effects have a 20% chance to reroll once",
        effects: [{ kind: "goodFortune", amount: 20 }],
      },
      {
        description: "Failed allied chance effects have a 30% chance to reroll once",
        effects: [{ kind: "goodFortune", amount: 30 }],
      },
      {
        description: "Failed allied chance effects have a 40% chance to reroll once",
        effects: [{ kind: "goodFortune", amount: 40 }],
      },
      {
        description: "Failed allied chance effects have a 50% chance to reroll once",
        effects: [{ kind: "goodFortune", amount: 50 }],
      },
      {
        description: "Failed allied chance effects have a 60% chance to reroll once",
        effects: [{ kind: "goodFortune", amount: 60 }],
      },
    ],
  },
  cards: [
    {
      ...attack("euphera", "Twilight Lance", 5, "light"),
      id: "euphera-twilight-lance",
      purgeThorns: true,
      artwork: "action.euphera.twilight-lance",
    },
    {
      ...card("euphera", "Wish Exchange", "redistributeBlock", 1),
      id: "euphera-wish-exchange",
      artwork: "action.euphera.wish-exchange",
    },
    {
      ...card("euphera", "Possible Path", "redraw", 1),
      id: "euphera-possible-path",
      artwork: "action.euphera.possible-path",
    },
  ],
};
