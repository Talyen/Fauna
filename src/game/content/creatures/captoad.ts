import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const captoad: CreatureKit = {
  species: {
    id: "captoad",
    name: "Captoad",
    title: "Beneath the spotted cap",
    health: 30,
    color: "#cb8051",
    trait: "Sporecoat",
    passiveTiers: [
      {
        description: "Retaliate with 1 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 1 }],
      },
      {
        description: "Retaliate with 2 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 2 }],
      },
      {
        description: "Retaliate with 3 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 3 }],
      },
      {
        description: "Retaliate with 4 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 4 }],
      },
      {
        description: "Retaliate with 5 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 5 }],
      },
      {
        description: "Retaliate with 6 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 6 }],
      },
    ],
  },
  cards: [
    {
      ...attack("captoad", "Spore Puff", 2, "poison"),
      target: "allEnemies",
      artwork: "action.captoad.spore-puff",
    },
    {
      ...card("captoad", "Mushroom Guard", "guard", 3),
      target: "self",
      effects: [{ kind: "heal", amount: 3 }],
      artwork: "action.captoad.mushroom-guard",
    },
    {
      ...card("captoad", "Bogbound Leap", "swap", 1),
      effects: [{ kind: "draw", amount: 2 }],
      artwork: "action.captoad.bogbound-leap",
    },
  ],
};
