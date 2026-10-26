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
    card("coralcurl-guard", "Bubble Ward", "guard", 6, { target: "self" }),
    attack("coralcurl-attack", "Reef Jet", 6, "water"),
    card("coralcurl-swap", "Coral Spiral", "swap", 1, { effects: [{ kind: "blind", amount: 1 }] }),
  ],
};
