import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const dawncall: CreatureKit = {
  species: {
    id: "dawncall",
    name: "Dawncall",
    title: "The sunrise herald",
    health: 24,
    color: "#eab75b",
    trait: "Early Bird",
    passiveTiers: sixPassiveTiers([20, 35, 50, 65, 80, 100], (amount) => ({
      description:
        amount === 100
          ? "Your first attack each turn is a Critical Hit"
          : `Your first attack each turn gains ${amount}% Critical hit chance`,
      effects: [{ kind: "earlyBird", amount }],
    })),
  },
  cards: [
    {
      ...card("dawncall", "Dawn Cry", "teamCleanse", 1),
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.dawncall.dawn-cry",
    },
    {
      ...attack("dawncall", "Sunwing Sweep", 2, "light"),
      target: "allEnemies",
      artwork: "action.dawncall.sunwing-sweep",
    },
    {
      ...card("dawncall", "Morning Bloom", "heal", 2),
      target: "allAllies",
      artwork: "action.dawncall.morning-bloom",
    },
  ],
};
