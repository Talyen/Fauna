import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
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
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
          },
        ],
      },
      {
        description: "Light damage bounces once, with a 50% chance to bounce twice",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
          },
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
            chance: 0.5,
          },
        ],
      },
      {
        description: "Light damage bounces twice",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
        ],
      },
      {
        description: "Light damage bounces twice; Health restoration has a 50% chance to bounce once",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 1,
            chance: 0.5,
          },
        ],
      },
      {
        description:
          "Light damage bounces twice; Health restoration bounces once, with a 50% chance to bounce twice",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 1,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 1,
            chance: 0.5,
          },
        ],
      },
      {
        description: "Light damage and Health restoration bounce twice",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 2,
          },
        ],
      },
    ],
  },
  cards: [
    {
      ...attack("pollenmoth", "Dazzle Burst", 3, "light"),
      artwork: "action.pollenmoth.dazzle-burst",
      target: "randomEnemy",
    },
    {
      ...card("pollenmoth", "Petal Shelter", "teamGuard", 2),
      artwork: "action.pollenmoth.petal-shelter",
    },
    {
      ...card("pollenmoth", "Bloomwake", "heal", 3),
      effect: "heal",
      artwork: "action.pollenmoth.bloomwake",
      target: "mostInjured",
    },
  ],
};
