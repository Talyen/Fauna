import type { CreatureKit, CardDefinition } from "../types";
export const memento: CreatureKit = {
  species: {
    id: "memento",
    name: "Memento",
    title: "The palace that remembers",
    legendary: true,
    health: 60,
    color: "#d4a855",
    trait: "The Court Remembers",
    passiveTiers: [
      {
        description: "Each time you play a card, an Echo attacks for 3 Water damage",
        effects: [{ kind: "courtRemembers", amount: 3 }],
      },
      {
        description: "Each time you play a card, an Echo attacks for 4 Water damage",
        effects: [{ kind: "courtRemembers", amount: 4 }],
      },
      {
        description: "Each time you play a card, an Echo attacks for 5 Water damage",
        effects: [{ kind: "courtRemembers", amount: 5 }],
      },
      {
        description: "Each time you play a card, an Echo attacks for 6 Water damage",
        effects: [{ kind: "courtRemembers", amount: 6 }],
      },
      {
        description: "Each time you play a card, an Echo attacks for 7 Water damage",
        effects: [{ kind: "courtRemembers", amount: 7 }],
      },
      {
        description: "Each time you play a card, an Echo attacks for 8 Water damage",
        effects: [{ kind: "courtRemembers", amount: 8 }],
      },
    ],
  },
  cards: [
    {
      id: "memento-lost-procession",
      species: "memento",
      name: "Lost Procession",
      effect: "procession",
      value: 6,
      cost: 1,
      artwork: "action.memento.lost-procession",
    },
    {
      id: "memento-treasury-echo",
      species: "memento",
      name: "Treasury Echo",
      effect: "createPearls",
      value: 2,
      cost: 1,
      artwork: "action.memento.treasury-echo",
    },
    {
      id: "memento-drowned-revelation",
      species: "memento",
      name: "Drowned Revelation",
      effect: "draw",
      value: 2,
      cost: 1,
      artwork: "action.memento.drowned-revelation",
    },
  ],
};
export const PEARL: CardDefinition = {
  id: "memento-pearl",
  species: "memento",
  name: "Pearl",
  effect: "pearl",
  consume: true,
  value: 2,
  cost: 1,
  artwork: "action.memento.pearl",
};
