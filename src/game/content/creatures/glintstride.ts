import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const glintstride: CreatureKit = {
  species: {
    id: "glintstride",
    name: "Glintstride",
    title: "A step beyond the shimmer",
    health: 24,
    color: "#83c9ce",
    trait: "Wrong Foot",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Glintstride’s attacks deal ${amount} additional Light damage to Blinded enemies`,
      effects: [{ kind: "wrongFoot", amount }],
    })),
  },
  cards: [
    {
      ...attack("glintstride", "Prism Shear", 6, "light"),
      artwork: "action.glintstride.prism-shear",
    },
    {
      ...card("glintstride", "Mirage Run", "dodge", 30),
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.glintstride.mirage-run",
    },
    {
      ...card("glintstride", "False Horizon", "teamBlind", 1),
      artwork: "action.glintstride.false-horizon",
    },
  ],
};
