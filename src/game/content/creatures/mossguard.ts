import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const mossguard: CreatureKit = {
  species: {
    id: "mossguard",
    name: "Mossguard",
    title: "The gentle guardian",
    health: 32,
    color: "#9ead70",
    trait: "Overgrowth",
    passiveTiers: [
      {
        description: "Retain 10% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 10 }],
      },
      {
        description: "Retain 20% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 20 }],
      },
      {
        description: "Retain 30% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 30 }],
      },
      {
        description: "Retain 40% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 40 }],
      },
      {
        description: "Retain 50% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 50 }],
      },
      {
        description: "Retain 60% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 60 }],
      },
    ],
  },
  cards: [
    {
      ...card("mossguard", "Boulder Brace", "guard", 6),
      target: "self",
      artwork: "action.mossguard.boulder-brace",
    },
    {
      ...attack("mossguard", "Rooted Stomp", 2, "stun"),
      target: "allEnemies",
      artwork: "action.mossguard.rooted-stomp",
    },
    {
      ...card("mossguard", "Moss Renewal", "heal", 2),
      target: "allAllies",
      artwork: "action.mossguard.moss-renewal",
    },
  ],
};
