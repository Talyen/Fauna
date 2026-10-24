import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Oathara can play ${amount} fallen ally card${amount === 1 ? "" : "s"} per turn`,
      effects: [{ kind: "unfinishedJourney", amount }],
    })),
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
