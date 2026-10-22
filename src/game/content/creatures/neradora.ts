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
    passiveTiers: [
      {
        description: "Restore 1 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 1 }],
      },
      {
        description: "Restore 2 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 2 }],
      },
      {
        description: "Restore 3 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 3 }],
      },
      {
        description: "Restore 4 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 4 }],
      },
      {
        description: "Restore 5 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 5 }],
      },
      {
        description: "Restore 6 Health every other turn",
        effects: [{ kind: "tidalRegeneration", amount: 6 }],
      },
    ],
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
