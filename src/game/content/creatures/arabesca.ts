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
    {
      ...attack("arabesca", "Ribbon Snare", 6, "stun"),
      id: "arabesca-ribbon-snare",
      artwork: "action.arabesca.ribbon-snare",
    },
    {
      ...card("arabesca", "Springbound", "springbound", 30),
      id: "arabesca-springbound",
      artwork: "action.arabesca.springbound",
    },
    {
      ...card("arabesca", "Dancing Double", "repeatNextCard", 1),
      id: "arabesca-dancing-double",
      artwork: "action.arabesca.dancing-double",
    },
  ],
};
