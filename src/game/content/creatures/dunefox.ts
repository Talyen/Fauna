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
    {
      ...attack("dunefox", "Sandburst Pounce", 6, "physical"),
      artwork: "action.dunefox.sandburst-pounce",
    },
    {
      ...attack("dunefox", "Dune Whirl", 1, "physical"),
      id: "dunefox-dune-whirl",
      target: "allEnemies",
      effects: [{ kind: "blind", amount: 1 }],
      artwork: "action.dunefox.dune-whirl",
    },
    {
      ...card("dunefox", "Mirage Step", "dodge", 30),
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.dunefox.mirage-step",
    },
  ],
};
