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
    attack("rookhaven-borrowed-brilliance", "Borrowed Brilliance", 1, "light", {
      target: "allEnemies",
      effects: [{ kind: "blind", amount: 1 }],
    }),
    card("rookhaven-unwritten-ending", "Unwritten Ending", "teamPurge", 1),
    card("rookhaven-margin-of-possibility", "Margin of Possibility", "draw", 2),
  ],
};
