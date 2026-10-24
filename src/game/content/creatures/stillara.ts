import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
      description: `Allies take ${amount}% less Freeze damage`,
      effects: [{ kind: "teamFreezeResistance", amount }],
    })),
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
