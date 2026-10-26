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
    card("cadenza-resonant-well", "Resonant Well", "draw", 2, { effects: [{ kind: "mana", amount: 1 }] }),
    card("cadenza-echoes-remember", "Echoes Remember", "recover", 1),
    card("cadenza-rousing-refrain", "Rousing Refrain", "dodge", 20, {
      target: "allAllies",
      effects: [{ kind: "draw", amount: 1 }],
    }),
  ],
};
