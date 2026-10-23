import { card } from "../card-builders";
import type { CreatureKit } from "../types";

export const oathara: CreatureKit = {
  species: {
    id: "oathara",
    name: "Oathara",
    title: "The keeper of unfinished journeys",
    health: 30,
    color: "#e5b85a",
    trait: "Unfinished Journey",
    passiveTiers: [
      {
        description: "Oathara can play 1 fallen ally card per turn",
        effects: [{ kind: "unfinishedJourney", amount: 1 }],
      },
      {
        description: "Oathara can play 2 fallen ally cards per turn",
        effects: [{ kind: "unfinishedJourney", amount: 2 }],
      },
      {
        description: "Oathara can play 3 fallen ally cards per turn",
        effects: [{ kind: "unfinishedJourney", amount: 3 }],
      },
      {
        description: "Oathara can play 4 fallen ally cards per turn",
        effects: [{ kind: "unfinishedJourney", amount: 4 }],
      },
      {
        description: "Oathara can play 5 fallen ally cards per turn",
        effects: [{ kind: "unfinishedJourney", amount: 5 }],
      },
      {
        description: "Oathara can play 6 fallen ally cards per turn",
        effects: [{ kind: "unfinishedJourney", amount: 6 }],
      },
    ],
  },
  cards: [
    {
      ...card("oathara", "Never Lost", "redraw", 1),
      id: "oathara-never-lost",
      artwork: "action.oathara.never-lost",
    },
    {
      ...card("oathara", "Traveler’s Ward", "reflectAttack", 1),
      id: "oathara-travelers-ward",
      artwork: "action.oathara.travelers-ward",
    },
    {
      ...card("oathara", "Vow of Return", "resurrect", 20),
      id: "oathara-vow-of-return",
      artwork: "action.oathara.vow-of-return",
    },
  ],
};
