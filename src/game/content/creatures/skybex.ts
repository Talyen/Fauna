import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";

export const skybex: CreatureKit = {
  species: {
    id: "skybex",
    name: "Skybex",
    title: "The mountain guide",
    health: 26,
    color: "#83b9d7",
    trait: "Mountain Guide",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Allies gain ${amount} Block when they swap in`,
      effects: [{ kind: "mountainGuide", amount }],
    })),
  },
  cards: [
    { ...card("skybex", "Far Horizon", "draw", 2), artwork: "action.skybex.far-horizon" },
    {
      ...card("skybex", "Cloudstep", "swapDodge", 20),
      id: "skybex-cloudstep",
      artwork: "action.skybex.cloudstep",
    },
    {
      ...attack("skybex", "Sky Shepherd", 2, "nature"),
      id: "skybex-sky-shepherd",
      target: "allEnemies",
      artwork: "action.skybex.sky-shepherd",
    },
  ],
};
