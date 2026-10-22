import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const rookhaven: CreatureKit = {
  species: {
    id: "rookhaven",
    name: "Rookhaven",
    title: "The keeper of forgotten stories",
    health: 26,
    color: "#8da9bc",
    trait: "Well Read",
    passiveTiers: [
      {
        description: "Drawing a card has a 20% chance to copy it",
        effects: [{ kind: "wellRead", amount: 20 }],
      },
      {
        description: "Drawing a card has a 35% chance to copy it",
        effects: [{ kind: "wellRead", amount: 35 }],
      },
      {
        description: "Drawing a card has a 50% chance to copy it",
        effects: [{ kind: "wellRead", amount: 50 }],
      },
      {
        description: "Drawing a card has a 70% chance to copy it",
        effects: [{ kind: "wellRead", amount: 70 }],
      },
      {
        description: "Drawing a card has an 85% chance to copy it",
        effects: [{ kind: "wellRead", amount: 85 }],
      },
      {
        description: "Drawing a card copies it",
        effects: [{ kind: "wellRead", amount: 100 }],
      },
    ],
  },
  cards: [
    {
      ...attack("rookhaven", "Borrowed Brilliance", 1, "light"),
      id: "rookhaven-borrowed-brilliance",
      target: "allEnemies",
      effects: [{ kind: "blind", amount: 1 }],
      artwork: "action.rookhaven.borrowed-brilliance",
    },
    {
      ...card("rookhaven", "Unwritten Ending", "teamPurge", 1),
      id: "rookhaven-unwritten-ending",
      artwork: "action.rookhaven.unwritten-ending",
    },
    {
      ...card("rookhaven", "Margin of Possibility", "draw", 2),
      id: "rookhaven-margin-of-possibility",
      artwork: "action.rookhaven.margin-of-possibility",
    },
  ],
};
