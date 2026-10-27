import { sixPassiveTiers } from "../passive-tiers";
import { card } from "../card-builders";
import type { CreatureKit } from "../types";
export const neradora: CreatureKit = {
  species: {
    id: "neradora",
    name: "Neradora",
    title: "The living tide flower",
    health: 28,
    color: "#ed795c",
    trait: "Tidal Regeneration",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Restore ${amount} Health every other turn`,
      effects: [{ kind: "tidalRegeneration", amount }],
    })),
  },
  cards: [
    card("neradora-undertow-knot", "Undertow Knot", "guard", 4, {
      target: "self",
      effects: [{ kind: "cleanse", amount: 1 }],
    }),
    card("neradora-bloom-shelter", "Bloom Shelter", "heal", 2, { target: "allAllies" }),
    card("neradora-tide-cup", "Tide Cup", "draw", 2, { effects: [{ kind: "mana", amount: 1 }] }),
  ],
};
