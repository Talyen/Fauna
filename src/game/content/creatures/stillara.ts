import { card } from "../card-builders";
import type { CreatureKit } from "../types";
export const stillara: CreatureKit = {
  species: {
    id: "stillara",
    name: "Stillara",
    title: "The keeper of summer",
    health: 26,
    color: "#94aabd",
    trait: "First Thaw",
    passiveTiers: [
      {
        description: "Allies take 10% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 10 }],
      },
      {
        description: "Allies take 20% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 20 }],
      },
      {
        description: "Allies take 30% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 30 }],
      },
      {
        description: "Allies take 40% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 40 }],
      },
      {
        description: "Allies take 50% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 50 }],
      },
      {
        description: "Allies take 60% less Freeze damage",
        effects: [{ kind: "teamFreezeResistance", amount: 60 }],
      },
    ],
  },
  cards: [
    {
      ...card("stillara", "Reed Reservoir", "mana", 2),
      id: "stillara-reed-reservoir",
      artwork: "action.stillara.reed-reservoir",
    },
    {
      ...card("stillara", "Thaw Path", "teamThaw", 1),
      id: "stillara-thaw-path",
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.stillara.thaw-path",
    },
    {
      ...card("stillara", "Water Remembers", "heal", 1),
      id: "stillara-water-remembers",
      target: "allAllies",
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.stillara.water-remembers",
    },
  ],
};
