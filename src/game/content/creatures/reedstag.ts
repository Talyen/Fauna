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
    attack("reedstag-attack", "Reed Rush", 6, "nature"),
    card("reedstag-guard", "Reed Shelter", "guard", 3, {
      target: "self",
      effects: [{ kind: "status", status: "thorns", amount: 3 }],
    }),
    card("reedstag-heal", "Mending Spring", "heal", 4, {
      target: "mostInjured",
      effects: [{ kind: "cleanse", amount: 7, target: "recipient" }],
    }),
  ],
};
