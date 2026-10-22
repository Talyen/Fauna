import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const chimecricket: CreatureKit = {
  species: {
    id: "chimecricket",
    name: "Chimecricket",
    title: "The evening chorus",
    health: 24,
    color: "#c2b66c",
    trait: "Encore",
    passiveTiers: [
      {
        description: "Your first ability each turn has a 10% chance to repeat",
        effects: [{ kind: "encore", amount: 10 }],
      },
      {
        description: "Your first ability each turn has a 20% chance to repeat",
        effects: [{ kind: "encore", amount: 20 }],
      },
      {
        description: "Your first ability each turn has a 30% chance to repeat",
        effects: [{ kind: "encore", amount: 30 }],
      },
      {
        description: "Your first ability each turn has a 40% chance to repeat",
        effects: [{ kind: "encore", amount: 40 }],
      },
      {
        description: "Your first ability each turn has a 50% chance to repeat",
        effects: [{ kind: "encore", amount: 50 }],
      },
      {
        description: "Your first ability each turn has a 60% chance to repeat",
        effects: [{ kind: "encore", amount: 60 }],
      },
    ],
  },
  cards: [
    {
      ...attack("chimecricket", "Resonant Leap", 4, "stun"),
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.chimecricket.resonant-leap",
    },
    {
      ...card("chimecricket", "Hush Dome", "nullify", 1),
      artwork: "action.chimecricket.hush-dome",
    },
    {
      ...card("chimecricket", "Lullaby Drift", "heal", 4),
      target: "mostInjured",
      effects: [{ kind: "cleanse", amount: 6, target: "recipient" }],
      artwork: "action.chimecricket.lullaby-drift",
    },
  ],
};
