import { card } from "../card-builders";
import type { CreatureKit } from "../types";
export const bloomquail: CreatureKit = {
  species: {
    id: "bloomquail",
    name: "Bloomquail",
    title: "The petal keeper",
    health: 26,
    color: "#ed9c9b",
    trait: "Full Bloom",
    passiveTiers: [
      {
        description: "Convert 50% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 50 }],
      },
      {
        description: "Convert 60% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 60 }],
      },
      {
        description: "Convert 70% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 70 }],
      },
      {
        description: "Convert 80% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 80 }],
      },
      {
        description: "Convert 90% of your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 90 }],
      },
      {
        description: "Convert your Block into Health for the most injured ally",
        effects: [{ kind: "blockConversion", amount: 100 }],
      },
    ],
  },
  cards: [
    {
      ...card("bloomquail", "Petal Rampart", "guard", 6),
      target: "self",
      artwork: "action.bloomquail.petal-rampart",
    },
    {
      ...card("bloomquail", "Bloom Cradle", "draw", 2),
      effects: [{ kind: "heal", amount: 2 }],
      artwork: "action.bloomquail.bloom-cradle",
    },
    {
      ...card("bloomquail", "Petal Veil", "heal", 2),
      target: "allAllies",
      effects: [{ kind: "blind", amount: 1 }],
      artwork: "action.bloomquail.petal-veil",
    },
  ],
};
