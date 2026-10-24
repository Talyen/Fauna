import { sixPassiveTiers } from "../passive-tiers";
import { card } from "../card-builders";
import type { CreatureKit } from "../types";
export const cadenza: CreatureKit = {
  species: {
    id: "cadenza",
    name: "Cadenza",
    title: "The song of forgotten places",
    health: 28,
    color: "#d4a855",
    trait: "Living Chorus",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `After your second card each turn, restore ${amount} Health to the most injured ally`,
      effects: [{ kind: "livingChorus", amount }],
    })),
  },
  cards: [
    {
      ...card("cadenza", "Resonant Well", "draw", 2),
      id: "cadenza-resonant-well",
      effects: [{ kind: "mana", amount: 1 }],
      artwork: "action.cadenza.resonant-well",
    },
    {
      ...card("cadenza", "Echoes Remember", "recover", 1),
      id: "cadenza-echoes-remember",
      artwork: "action.cadenza.echoes-remember",
    },
    {
      ...card("cadenza", "Rousing Refrain", "dodge", 20),
      target: "allAllies",
      id: "cadenza-rousing-refrain",
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.cadenza.rousing-refrain",
    },
  ],
};
