import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([20, 35, 50, 70, 85, 100], (amount) => ({
      description:
        amount === 100
          ? "Drawing a card copies it"
          : `Drawing a card has ${amount === 85 ? "an" : "a"} ${amount}% chance to copy it`,
      effects: [{ kind: "wellRead", amount }],
    })),
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
