import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
const bounce = (effect: "light" | "heal", amount: number, options: { chance?: number } = {}) => ({
  kind: "bounce" as const,
  effect,
  amount,
  ...options,
});

export const pollenmoth: CreatureKit = {
  species: {
    id: "pollenmoth",
    name: "Pollenmoth",
    title: "A golden wake of flowers",
    health: 23,
    color: "#dbaf52",
    trait: "Cross-Pollination",
    passiveTiers: [
      {
        description: "Light damage bounces once",
        effects: [bounce("light", 1)],
      },
      {
        description: "Light damage bounces once, with a 50% chance to bounce twice",
        effects: [bounce("light", 1), bounce("light", 1, { chance: 0.5 })],
      },
      {
        description: "Light damage bounces twice",
        effects: [bounce("light", 2)],
      },
      {
        description: "Light damage bounces twice; Health restoration has a 50% chance to bounce once",
        effects: [bounce("light", 2), bounce("heal", 1, { chance: 0.5 })],
      },
      {
        description:
          "Light damage bounces twice; Health restoration bounces once, with a 50% chance to bounce twice",
        effects: [bounce("light", 2), bounce("heal", 1), bounce("heal", 1, { chance: 0.5 })],
      },
      {
        description: "Light damage and Health restoration bounce twice",
        effects: [bounce("light", 2), bounce("heal", 2)],
      },
    ],
  },
  cards: [
    attack("pollenmoth-attack", "Dazzle Burst", 3, "light", { target: "randomEnemy" }),
    card("pollenmoth-teamGuard", "Petal Shelter", "guard", 2, { target: "allAllies" }),
    card("pollenmoth-heal", "Bloomwake", "heal", 3, { target: "mostInjured" }),
  ],
};
