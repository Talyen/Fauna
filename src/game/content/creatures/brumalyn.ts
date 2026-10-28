import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const brumalyn: CreatureKit = {
  species: {
    id: "brumalyn",
    name: "Brumalyn",
    title: "The winter guide",
    health: 30,
    color: "#9bb5d0",
    trait: "Winter’s Reprieve",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `When an ally Freezes an enemy, restore ${amount} Health to all allies`,
      effects: [{ kind: "wintersReprieve", amount }],
    })),
  },
  cards: [
    card("brumalyn-warmth-ward", "Warmth Ward", "heal", 1, {
      target: "allAllies",
      effects: [{ kind: "thaw", amount: 1 }],
    }),
    attack("brumalyn-rime-pounce", "Rime Pounce", 6, "freeze"),
    attack("brumalyn-frost-howl", "Frost Howl", 2, "freeze", {
      alternateDamageType: "stun",
      target: "allEnemies",
    }),
  ],
};
