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
    {
      ...card("wisterelle", "Forgotten Junction", "swapChosen", 1),
      id: "wisterelle-forgotten-junction",
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.wisterelle.forgotten-junction",
    },
    {
      ...card("wisterelle", "Lantern Fare", "heal", 3),
      id: "wisterelle-lantern-fare",
      target: "injured",
      effects: [{ kind: "mana", amount: 1 }],
      artwork: "action.wisterelle.lantern-fare",
    },
    {
      ...card("wisterelle", "Left Luggage", "recover", 1),
      id: "wisterelle-left-luggage",
      allyOnly: true,
      effects: [{ kind: "mana", amount: 1 }],
      artwork: "action.wisterelle.left-luggage",
    },
  ],
};
