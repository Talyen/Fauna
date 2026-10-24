import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
      description: `Harmful status effects you receive have a ${amount}% chance to be redirected to a random enemy`,
      effects: [{ kind: "statusReflection", amount }],
    })),
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
