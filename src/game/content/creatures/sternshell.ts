import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const sternshell: CreatureKit = {
  species: {
    id: "sternshell",
    name: "Sternshell",
    title: "The steadfast voyager",
    health: 32,
    color: "#cb7c45",
    trait: "Shelter",
    passiveTiers: [
      {
        description: "Sternshell starts combat with 2 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 2 }],
      },
      {
        description: "Sternshell starts combat with 3 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 3 }],
      },
      {
        description: "Sternshell starts combat with 4 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 4 }],
      },
      {
        description: "Sternshell starts combat with 5 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 5 }],
      },
      {
        description: "Sternshell starts combat with 6 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 6 }],
      },
      {
        description: "Sternshell starts combat with 7 Armor",
        effects: [{ kind: "battleStart", effect: "armor", amount: 7 }],
      },
    ],
  },
  cards: [
    {
      ...attack("sternshell", "Surge Ram", 3, "physical"),
      doubleWithArmor: true,
      artwork: "action.sternshell.surge-ram",
    },
    {
      ...card("sternshell", "Siphon Vault", "swap", 1),
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.sternshell.siphon-vault",
    },
    {
      ...attack("sternshell", "Spiral Return", 1, "water"),
      id: "sternshell-spiral-return",
      target: "allEnemies",
      effects: [{ kind: "mana", amount: 1 }],
      artwork: "action.sternshell.spiral-return",
    },
  ],
};
