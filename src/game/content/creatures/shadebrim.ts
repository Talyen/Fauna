import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const shadebrim: CreatureKit = {
  species: {
    id: "shadebrim",
    name: "Shadebrim",
    title: "The cool refuge",
    health: 28,
    color: "#dbaf52",
    trait: "Cool Refuge",
    passiveTiers: sixPassiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
      description: `Allies take ${amount}% less Burn damage`,
      effects: [{ kind: "teamBurnResistance", amount }],
    })),
  },
  cards: [
    card("shadebrim-guard", "Noonward", "guard", 4, {
      target: "self",
      effects: [{ kind: "reflect", amount: 1, status: "burn" }],
    }),
    attack("shadebrim-attack", "Coolfront", 1, "freeze", {
      target: "allEnemies",
      effects: [{ kind: "cleanse", amount: 7, target: "allAllies" }],
    }),
    card("shadebrim-draw", "Noon Bloom", "draw", 2, { effects: [{ kind: "mana", amount: 1 }] }),
  ],
};
