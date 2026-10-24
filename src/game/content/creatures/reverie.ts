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
    {
      ...card("reverie", "Waking Wonder", "draw", 2),
      id: "reverie-waking-wonder",
      artwork: "action.reverie.waking-wonder",
    },
    {
      ...card("reverie", "Dream Double", "dreamDouble", 3),
      id: "reverie-dream-double",
      artwork: "action.reverie.dream-double",
    },
    {
      ...card("reverie", "Nightmare Harvest", "nightmareHarvest", 1),
      id: "reverie-nightmare-harvest",
      artwork: "action.reverie.nightmare-harvest",
    },
  ],
};
