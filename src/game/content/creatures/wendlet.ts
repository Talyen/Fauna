import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const wendlet: CreatureKit = {
  species: {
    id: "wendlet",
    name: "Wendlet",
    title: "The shadow's companion",
    health: 24,
    color: "#7285aa",
    trait: "Living Shadow",
    passiveTiers: sixPassiveTiers([50, 60, 70, 80, 90, 100], (amount) => ({
      description: `When Wendlet's Block decays, give ${amount}% of the lost Block to the most injured ally`,
      effects: [{ kind: "livingShadow", amount }],
    })),
  },
  cards: [
    card("wendlet-midnight-mantle", "Midnight Mantle", "dodge", 20, {
      effects: [{ kind: "status", status: "block", amount: 3 }],
    }),
    attack("wendlet-umbra-snare", "Umbra Snare", 6, "stun"),
    card("wendlet-borrowed-silhouette", "Borrowed Silhouette", "borrowBackup", 1),
  ],
};
