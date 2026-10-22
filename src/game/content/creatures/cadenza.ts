import { card } from "../card-builders";
import type { CreatureKit } from "../types";
export const cadenza: CreatureKit = {
  species: {
    id: "cadenza",
    name: "Cadenza",
    title: "The song of forgotten places",
    health: 28,
    color: "#d4a855",
    trait: "Living Chorus",
    passiveTiers: [
      {
        description: "After your second card each turn, restore 1 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 1 }],
      },
      {
        description: "After your second card each turn, restore 2 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 2 }],
      },
      {
        description: "After your second card each turn, restore 3 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 3 }],
      },
      {
        description: "After your second card each turn, restore 4 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 4 }],
      },
      {
        description: "After your second card each turn, restore 5 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 5 }],
      },
      {
        description: "After your second card each turn, restore 6 Health to the most injured ally",
        effects: [{ kind: "livingChorus", amount: 6 }],
      },
    ],
  },
  cards: [
    {
      ...card("cadenza", "Resonant Well", "draw", 2),
      id: "cadenza-resonant-well",
      effects: [{ kind: "mana", amount: 1 }],
      artwork: "action.cadenza.resonant-well",
    },
    {
      ...card("cadenza", "Echoes Remember", "recover", 1),
      id: "cadenza-echoes-remember",
      artwork: "action.cadenza.echoes-remember",
    },
    {
      ...card("cadenza", "Rousing Refrain", "teamDodge", 20),
      id: "cadenza-rousing-refrain",
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.cadenza.rousing-refrain",
    },
  ],
};
