import { sixPassiveTiers } from "../passive-tiers";
import { card } from "../card-builders";
import type { CreatureKit } from "../types";

export const reverie: CreatureKit = {
  species: {
    id: "reverie",
    name: "Reverie",
    title: "The sanctuary of dreams",
    health: 28,
    color: "#a9b775",
    trait: "Unhurried",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `At the end of your turn, each ally that played no cards restores ${amount} Health`,
      effects: [{ kind: "unhurried", amount }],
    })),
  },
  cards: [
    card("reverie-waking-wonder", "Waking Wonder", "draw", 2),
    card("reverie-dream-double", "Dream Double", "dreamDouble", 3),
    card("reverie-nightmare-harvest", "Nightmare Harvest", "nightmareHarvest", 1),
  ],
};
