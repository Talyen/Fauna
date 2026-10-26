import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const alpenglen: CreatureKit = {
  species: {
    id: "alpenglen",
    name: "Alpenglen",
    title: "The last light of the mountain",
    health: 30,
    color: "#d9ab60",
    trait: "Last Warmth",
    passiveTiers: sixPassiveTiers([2, 3, 4, 5, 6, 7], (amount) => ({
      description: `Playing the last card in your hand restores ${amount} Health to the most injured ally`,
      effects: [{ kind: "lastWarmth", amount }],
    })),
  },
  cards: [
    card("alpenglen-sunset-reversal", "Sunset Reversal", "reflectAttack", 1),
    card("alpenglen-ember-of-evening", "Ember of Evening", "repeatNextCard", 1),
    attack("alpenglen-last-light-charge", "Last Light Charge", 4, "light", { criticalWhenLastCard: true }),
  ],
};
