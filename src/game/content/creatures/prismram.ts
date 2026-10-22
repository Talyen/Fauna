import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const prismram: CreatureKit = {
  species: {
    id: "prismram",
    name: "Prismram",
    title: "The crystal sentinel",
    health: 30,
    color: "#b7b2e2",
    trait: "Refraction",
    passiveTiers: [
      {
        description:
          "Harmful status effects you receive have a 10% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 10 }],
      },
      {
        description:
          "Harmful status effects you receive have a 20% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 20 }],
      },
      {
        description:
          "Harmful status effects you receive have a 30% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 30 }],
      },
      {
        description:
          "Harmful status effects you receive have a 40% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 40 }],
      },
      {
        description:
          "Harmful status effects you receive have a 50% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 50 }],
      },
      {
        description:
          "Harmful status effects you receive have a 60% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 60 }],
      },
    ],
  },
  cards: [
    {
      ...attack("prismram", "Prism Charge", 6, "physical"),
      artwork: "action.prismram.prism-charge",
    },
    {
      ...card("prismram", "Faceted Ward", "guard", 3),
      target: "self",
      artwork: "action.prismram.faceted-ward",
      effects: [{ kind: "reflect", amount: 1 }],
    },
    {
      ...attack("prismram", "Spectrum Lance", 4, "light"),
      id: "prismram-spectrum-lance",
      artwork: "action.prismram.spectrum-lance",
      effects: [{ kind: "purge", amount: 1 }],
    },
  ],
};
