import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const dawncall: CreatureKit = {
  species: {
    id: "dawncall",
    name: "Dawncall",
    title: "The sunrise herald",
    health: 24,
    color: "#eab75b",
    trait: "Early Bird",
    passiveTiers: [
      {
        description: "Your first attack each turn gains 20% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 20 }],
      },
      {
        description: "Your first attack each turn gains 35% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 35 }],
      },
      {
        description: "Your first attack each turn gains 50% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 50 }],
      },
      {
        description: "Your first attack each turn gains 65% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 65 }],
      },
      {
        description: "Your first attack each turn gains 80% Critical hit chance",
        effects: [{ kind: "earlyBird", amount: 80 }],
      },
      {
        description: "Your first attack each turn is a Critical Hit",
        effects: [{ kind: "earlyBird", amount: 100 }],
      },
    ],
  },
  cards: [
    {
      ...card("dawncall", "Dawn Cry", "teamCleanse", 1),
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.dawncall.dawn-cry",
    },
    {
      ...attack("dawncall", "Sunwing Sweep", 2, "light"),
      target: "allEnemies",
      artwork: "action.dawncall.sunwing-sweep",
    },
    {
      ...card("dawncall", "Morning Bloom", "heal", 2),
      target: "allAllies",
      artwork: "action.dawncall.morning-bloom",
    },
  ],
};
