import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Retaliate with ${amount} Poison damage when hit`,
      effects: [{ kind: "poisonRetaliation", amount }],
    })),
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
