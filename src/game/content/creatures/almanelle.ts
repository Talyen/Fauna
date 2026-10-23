import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const almanelle: CreatureKit = {
  species: {
    id: "almanelle",
    name: "Almanelle",
    title: "The orchard through the seasons",
    health: 28,
    color: "#d99457",
    trait: "Fallen Leaves",
    passiveTiers: [
      {
        description: "50% of decaying Block becomes Thorns",
        effects: [{ kind: "fallenLeaves", amount: 50 }],
      },
      {
        description: "60% of decaying Block becomes Thorns",
        effects: [{ kind: "fallenLeaves", amount: 60 }],
      },
      {
        description: "70% of decaying Block becomes Thorns",
        effects: [{ kind: "fallenLeaves", amount: 70 }],
      },
      {
        description: "80% of decaying Block becomes Thorns",
        effects: [{ kind: "fallenLeaves", amount: 80 }],
      },
      {
        description: "90% of decaying Block becomes Thorns",
        effects: [{ kind: "fallenLeaves", amount: 90 }],
      },
      {
        description: "Decaying Block becomes Thorns",
        effects: [{ kind: "fallenLeaves", amount: 100 }],
      },
    ],
  },
  cards: [
    {
      ...attack("almanelle", "Spring Current", 4, "water"),
      id: "almanelle-spring-current",
      effects: [{ kind: "cleanse", amount: 1 }],
      artwork: "action.almanelle.spring-current",
    },
    {
      ...card("almanelle", "Autumn Insight", "recover", 1),
      id: "almanelle-autumn-insight",
      target: "ally",
      effects: [{ kind: "heal", amount: 3, target: "recipient" }],
      artwork: "action.almanelle.autumn-insight",
    },
    {
      ...card("almanelle", "Rooted Year", "guard", 3),
      target: "self",
      effects: [{ kind: "status", status: "thorns", amount: 3 }],
      id: "almanelle-rooted-year",
      artwork: "action.almanelle.rooted-year",
    },
  ],
};
