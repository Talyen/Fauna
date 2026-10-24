import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
      description: `Your first ability each turn has a ${amount}% chance to repeat`,
      effects: [{ kind: "encore", amount }],
    })),
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
