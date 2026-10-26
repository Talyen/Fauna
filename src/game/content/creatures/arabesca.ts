import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const arabesca: CreatureKit = {
  species: {
    id: "arabesca",
    name: "Arabesca",
    title: "The dance of returning spring",
    health: 26,
    color: "#e8a397",
    trait: "Petalwake",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Restore ${amount} Health to allies when you Dodge`,
      effects: [{ kind: "petalwake", amount }],
    })),
  },
  cards: [
    attack("arabesca-ribbon-snare", "Ribbon Snare", 6, "stun"),
    card("arabesca-springbound", "Springbound", "springbound", 30),
    card("arabesca-dancing-double", "Dancing Double", "repeatNextCard", 1),
  ],
};
