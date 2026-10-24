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
    {
      ...card("neradora", "Undertow Knot", "waterThorns", 3),
      id: "neradora-undertow-knot",
      artwork: "action.neradora.undertow-knot",
    },
    {
      ...card("neradora", "Bloom Shelter", "heal", 2),
      id: "neradora-bloom-shelter",
      target: "allAllies",
      artwork: "action.neradora.bloom-shelter",
    },
    {
      ...card("neradora", "Tide Cup", "draw", 2),
      id: "neradora-tide-cup",
      effects: [{ kind: "mana", amount: 1 }],
      artwork: "action.neradora.tide-cup",
    },
  ],
};
