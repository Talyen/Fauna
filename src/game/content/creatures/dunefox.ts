import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const dunefox: CreatureKit = {
  species: {
    id: "dunefox",
    name: "Dunefox",
    title: "The shifting mirage",
    health: 24,
    color: "#d9aa57",
    trait: "Shifting Sands",
    passiveTiers: sixPassiveTiers([15, 20, 25, 30, 35, 40], (amount) => ({
      description: `Allies gain ${amount}% of your Dodge chance`,
      effects: [{ kind: "shareDodge", amount }],
    })),
  },
  cards: [
    attack("dunefox-attack", "Sandburst Pounce", 6, "physical"),
    attack("dunefox-dune-whirl", "Dune Whirl", 1, "physical", {
      target: "allEnemies",
      effects: [{ kind: "blind", amount: 1 }],
    }),
    card("dunefox-dodge", "Mirage Step", "dodge", 30, { effects: [{ kind: "draw", amount: 1 }] }),
  ],
};
