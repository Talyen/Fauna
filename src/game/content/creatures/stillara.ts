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
    card("stillara-reed-reservoir", "Reed Reservoir", "mana", 2),
    card("stillara-thaw-path", "Thaw Path", "teamThaw", 1, { effects: [{ kind: "draw", amount: 1 }] }),
    card("stillara-water-remembers", "Water Remembers", "heal", 1, {
      target: "allAllies",
      effects: [{ kind: "draw", amount: 1 }],
    }),
  ],
};
