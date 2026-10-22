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
    passiveTiers: [
      {
        description: "Ringpalm’s Stun damage has a 10% chance to repeat",
        effects: [{ kind: "resonance", amount: 10 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 20% chance to repeat",
        effects: [{ kind: "resonance", amount: 20 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 30% chance to repeat",
        effects: [{ kind: "resonance", amount: 30 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 40% chance to repeat",
        effects: [{ kind: "resonance", amount: 40 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 50% chance to repeat",
        effects: [{ kind: "resonance", amount: 50 }],
      },
      {
        description: "Ringpalm’s Stun damage has a 60% chance to repeat",
        effects: [{ kind: "resonance", amount: 60 }],
      },
    ],
  },
  cards: [
    {
      ...attack("ringpalm", "Ringclap", 6, "stun"),
      artwork: "action.ringpalm.ringclap",
    },
    {
      ...attack("ringpalm", "Harmonic Set", 1, "stun"),
      id: "ringpalm-harmonic-set",
      target: "allEnemies",
      effects: [{ kind: "status", status: "armor", amount: 1 }],
      repeatChance: 20,
      artwork: "action.ringpalm.harmonic-set",
    },
    {
      ...card("ringpalm", "Seedling Circle", "teamProtection", 2),
      artwork: "action.ringpalm.seedling-circle",
    },
  ],
};
