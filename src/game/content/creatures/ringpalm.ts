import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const ringpalm: CreatureKit = {
  species: {
    id: "ringpalm",
    name: "Ringpalm",
    title: "The stone-circle guardian",
    health: 30,
    color: "#9ead70",
    trait: "Resonance",
    passiveTiers: sixPassiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
      description: `Ringpalm’s Stun damage has a ${amount}% chance to repeat`,
      effects: [{ kind: "resonance", amount }],
    })),
  },
  cards: [
    attack("ringpalm-attack", "Ringclap", 6, "stun"),
    attack("ringpalm-harmonic-set", "Harmonic Set", 1, "stun", {
      target: "allEnemies",
      effects: [{ kind: "status", status: "armor", amount: 1 }],
      repeatChance: 20,
    }),
    card("ringpalm-teamProtection", "Seedling Circle", "teamProtection", 2),
  ],
};
