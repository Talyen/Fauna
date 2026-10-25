import { sixPassiveTiers } from "../passive-tiers";
import { card } from "../card-builders";
import type { CreatureKit } from "../types";

export const dulcera: CreatureKit = {
  species: {
    id: "dulcera",
    name: "Dulcera",
    title: "The gentle sanctuary",
    health: 30,
    color: "#8daebc",
    trait: "Gentle Passage",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Allies restore ${amount} Health when they swap in`,
      effects: [{ kind: "gentlePassage", amount }],
    })),
  },
  cards: [
    {
      ...card("dulcera", "Chapel Light", "heal", 3),
      id: "dulcera-chapel-light",
      target: "self",
      effects: [{ kind: "mana", amount: 1 }],
      artwork: "action.dulcera.chapel-light",
    },
    {
      ...card("dulcera", "Meadow Shelter", "guard", 2),
      id: "dulcera-meadow-shelter",
      target: "allAllies",
      artwork: "action.dulcera.meadow-shelter",
    },
    {
      ...card("dulcera", "Hushed Waters", "swap", 1),
      id: "dulcera-hushed-waters",
      backupOnly: true,
      effects: [{ kind: "cleanse", amount: 7, target: "allAllies" }],
      artwork: "action.dulcera.hushed-waters",
    },
  ],
};
