import { sixPassiveTiers } from "../passive-tiers";
import { card } from "../card-builders";
import type { CreatureKit } from "../types";

export const wisterelle: CreatureKit = {
  species: {
    id: "wisterelle",
    name: "Wisterelle",
    title: "The keeper of the flowering station",
    health: 26,
    color: "#b694ce",
    trait: "Lost and Found",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Drawing a card from your discard pile restores ${amount} Health to its owner`,
      effects: [{ kind: "lostAndFound", amount }],
    })),
  },
  cards: [
    card("wisterelle-forgotten-junction", "Forgotten Junction", "swapChosen", 1, {
      effects: [{ kind: "draw", amount: 1 }],
    }),
    card("wisterelle-lantern-fare", "Lantern Fare", "heal", 3, {
      target: "injured",
      effects: [{ kind: "mana", amount: 1 }],
    }),
    card("wisterelle-left-luggage", "Left Luggage", "recover", 1, {
      allyOnly: true,
      effects: [{ kind: "mana", amount: 1 }],
    }),
  ],
};
