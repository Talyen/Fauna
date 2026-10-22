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
    passiveTiers: [
      {
        description: "Allies take 10% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 10 }],
      },
      {
        description: "Allies take 20% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 20 }],
      },
      {
        description: "Allies take 30% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 30 }],
      },
      {
        description: "Allies take 40% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 40 }],
      },
      {
        description: "Allies take 50% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 50 }],
      },
      {
        description: "Allies take 60% less Burn damage",
        effects: [{ kind: "teamBurnResistance", amount: 60 }],
      },
    ],
  },
  cards: [
    {
      ...card("shadebrim", "Noonward", "guard", 4),
      target: "self",
      effects: [{ kind: "reflect", amount: 1, status: "burn" }],
      artwork: "action.shadebrim.noonward",
    },
    {
      ...attack("shadebrim", "Coolfront", 1, "freeze"),
      target: "allEnemies",
      effects: [{ kind: "cleanse", amount: 7, target: "allAllies" }],
      artwork: "action.shadebrim.coolfront",
    },
    {
      ...card("shadebrim", "Noon Bloom", "draw", 2),
      effects: [{ kind: "mana", amount: 1 }],
      artwork: "action.shadebrim.noon-bloom",
    },
  ],
};
