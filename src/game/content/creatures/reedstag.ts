import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([20, 40, 60, 80, 90, 100], (amount) => ({
      description:
        amount === 100
          ? "Block and Thorns are shared with allies"
          : `Block and Thorns have a ${amount}% chance to be shared with allies`,
      effects: [{ kind: "shareProtection", amount }],
    })),
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
