import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const coralcurl: CreatureKit = {
  species: {
    id: "coralcurl",
    name: "Coralcurl",
    title: "The sheltered reef",
    health: 28,
    color: "#f89983",
    trait: "Bubbleburst",
    passiveTiers: [
      {
        description: "Deal 1 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 1 }],
      },
      {
        description: "Deal 2 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 2 }],
      },
      {
        description: "Deal 3 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 3 }],
      },
      {
        description: "Deal 4 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 4 }],
      },
      {
        description: "Deal 5 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 5 }],
      },
      {
        description: "Deal 6 Water damage when your Block breaks",
        effects: [{ kind: "blockBreak", amount: 6 }],
      },
    ],
  },
  cards: [
    {
      ...card("coralcurl", "Bubble Ward", "guard", 6),
      target: "self",
      artwork: "action.coralcurl.bubble-ward",
    },
    { ...attack("coralcurl", "Reef Jet", 6, "water"), artwork: "action.coralcurl.reef-jet" },
    {
      ...card("coralcurl", "Coral Spiral", "swap", 1),
      effects: [{ kind: "blind", amount: 1 }],
      artwork: "action.coralcurl.coral-spiral",
    },
  ],
};
