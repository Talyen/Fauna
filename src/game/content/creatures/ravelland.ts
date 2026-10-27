import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const ravelland: CreatureKit = {
  species: {
    id: "ravelland",
    name: "Ravelland",
    title: "The walking canyon",
    legendary: true,
    health: 60,
    color: "#b6976f",
    trait: "Faultline",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Gain ${amount} Armor when damage breaks your Block`,
      effects: [{ kind: "faultline", amount }],
    })),
  },
  cards: [
    attack("ravelland-antler-pass", "Antler Pass", 8, "physical"),
    attack("ravelland-canyon-rebuke", "Canyon Rebuke", 3, "physical", { target: "allEnemies" }),
    card("ravelland-rainward", "Rainward", "guard", 6, { target: "self" }),
  ],
};
