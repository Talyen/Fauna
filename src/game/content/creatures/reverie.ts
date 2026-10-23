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
    passiveTiers: [
      {
        description: "At the end of your turn, each ally that played no cards restores 1 Health",
        effects: [{ kind: "unhurried", amount: 1 }],
      },
      {
        description: "At the end of your turn, each ally that played no cards restores 2 Health",
        effects: [{ kind: "unhurried", amount: 2 }],
      },
      {
        description: "At the end of your turn, each ally that played no cards restores 3 Health",
        effects: [{ kind: "unhurried", amount: 3 }],
      },
      {
        description: "At the end of your turn, each ally that played no cards restores 4 Health",
        effects: [{ kind: "unhurried", amount: 4 }],
      },
      {
        description: "At the end of your turn, each ally that played no cards restores 5 Health",
        effects: [{ kind: "unhurried", amount: 5 }],
      },
      {
        description: "At the end of your turn, each ally that played no cards restores 6 Health",
        effects: [{ kind: "unhurried", amount: 6 }],
      },
    ],
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
