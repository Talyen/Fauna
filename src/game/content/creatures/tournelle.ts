import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";

export const tournelle: CreatureKit = {
  species: {
    id: "tournelle",
    name: "Tournelle",
    title: "The little gallant",
    health: 30,
    color: "#b7453b",
    trait: "Gallantry",
    passiveTiers: [
      {
        description: "10% chance to intercept attacks against a more injured ally",
        effects: [{ kind: "gallantry", amount: 10 }],
      },
      {
        description: "20% chance to intercept attacks against a more injured ally",
        effects: [{ kind: "gallantry", amount: 20 }],
      },
      {
        description: "30% chance to intercept attacks against a more injured ally",
        effects: [{ kind: "gallantry", amount: 30 }],
      },
      {
        description: "40% chance to intercept attacks against a more injured ally",
        effects: [{ kind: "gallantry", amount: 40 }],
      },
      {
        description: "50% chance to intercept attacks against a more injured ally",
        effects: [{ kind: "gallantry", amount: 50 }],
      },
      {
        description: "60% chance to intercept attacks against a more injured ally",
        effects: [{ kind: "gallantry", amount: 60 }],
      },
    ],
  },
  cards: [
    {
      ...card("tournelle", "Kindled Courage", "teamClearBlind", 1),
      effects: [{ kind: "drawKeyword", keyword: "light", amount: 1 }],
      artwork: "action.tournelle.kindled-courage",
    },
    {
      ...attack("tournelle", "Valiant Challenge", 4, "light"),
      doubleAgainstHealthier: true,
      artwork: "action.tournelle.valiant-challenge",
    },
    {
      ...card("tournelle", "Safe Passage", "swapLowest", 1),
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.tournelle.safe-passage",
    },
  ],
};
