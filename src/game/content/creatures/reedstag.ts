import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const reedstag: CreatureKit = {
  species: {
    id: "reedstag",
    name: "Reedstag",
    title: "The living reedbed",
    health: 30,
    color: "#c2a052",
    trait: "Reedguard",
    passiveTiers: [
      {
        description: "Block and Thorns have a 20% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 20 }],
      },
      {
        description: "Block and Thorns have a 40% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 40 }],
      },
      {
        description: "Block and Thorns have a 60% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 60 }],
      },
      {
        description: "Block and Thorns have a 80% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 80 }],
      },
      {
        description: "Block and Thorns have a 90% chance to be shared with allies",
        effects: [{ kind: "shareProtection", amount: 90 }],
      },
      {
        description: "Block and Thorns are shared with allies",
        effects: [{ kind: "shareProtection", amount: 100 }],
      },
    ],
  },
  cards: [
    {
      ...attack("reedstag", "Reed Rush", 6, "nature"),
      artwork: "action.reedstag.reed-rush",
    },
    {
      ...card("reedstag", "Reed Shelter", "guard", 3),
      target: "self",
      effects: [{ kind: "status", status: "thorns", amount: 3 }],
      artwork: "action.reedstag.reed-shelter",
    },
    {
      ...card("reedstag", "Mending Spring", "heal", 4),
      target: "mostInjured",
      effects: [{ kind: "cleanse", amount: 7, target: "recipient" }],
      artwork: "action.reedstag.mending-spring",
    },
  ],
};
