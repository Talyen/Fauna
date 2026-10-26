import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([50, 60, 70, 80, 90, 100], (amount) => ({
      description:
        amount === 100
          ? "Convert your Block into Health for the most injured ally"
          : `Convert ${amount}% of your Block into Health for the most injured ally`,
      effects: [{ kind: "blockConversion", amount }],
    })),
  },
  cards: [
    card("bloomquail-guard", "Petal Rampart", "guard", 6, { target: "self" }),
    card("bloomquail-draw", "Bloom Cradle", "draw", 2, { effects: [{ kind: "heal", amount: 2 }] }),
    card("bloomquail-heal", "Petal Veil", "heal", 2, {
      target: "allAllies",
      effects: [{ kind: "blind", amount: 1 }],
    }),
  ],
};
