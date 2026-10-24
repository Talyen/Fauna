import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Deal ${amount} Water damage when your Block breaks`,
      effects: [{ kind: "blockBreak", amount }],
    })),
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
