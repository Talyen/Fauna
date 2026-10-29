import { sixPassiveTiers } from "../passive-tiers";
import { card } from "../card-builders";
import type { CreatureKit } from "../types";

export const cavalleaf: CreatureKit = {
  species: {
    id: "cavalleaf",
    name: "Cavalleaf",
    title: "The meadow pathmaker",
    health: 30,
    color: "#a5ad68",
    trait: "Wild Path",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Restoring Health to allies grants them ${amount} Thorns`,
      effects: [{ kind: "wildPath", amount }],
    })),
  },
  cards: [
    card("cavalleaf-meadow-return", "Meadow Return", "heal", 2, { target: "allAllies" }),
    card("cavalleaf-raincall", "Raincall", "raincall", 1),
    card("cavalleaf-prairie-leap", "Prairie Leap", "swapThorns", 4),
  ],
};
