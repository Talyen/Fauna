import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
      description: `Retain ${amount}% more Block between turns`,
      effects: [{ kind: "blockRetention", amount }],
    })),
  },
  cards: [
    card("mossguard-guard", "Boulder Brace", "guard", 6, { target: "self" }),
    attack("mossguard-attack", "Rooted Stomp", 2, "stun", { target: "allEnemies" }),
    card("mossguard-heal", "Moss Renewal", "heal", 2, { target: "allAllies" }),
  ],
};
