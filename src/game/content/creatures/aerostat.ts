import { sixPassiveTiers } from "../passive-tiers";
import { card } from "../card-builders";
import type { CreatureKit } from "../types";

export const aerostat: CreatureKit = {
  species: {
    id: "aerostat",
    name: "Aerostat",
    title: "The well-stocked traveler",
    health: 30,
    color: "#d6aa54",
    trait: "Well Provisioned",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Start with ${amount} Food card${amount === 1 ? "" : "s"} in your deck`,
      effects: [{ kind: "wellProvisioned", amount }],
    })),
  },
  cards: [
    {
      ...card("aerostat", "Voyager’s Rest", "guard", 6),
      id: "aerostat-voyagers-rest",
      target: "self",
      artwork: "action.aerostat.voyagers-rest",
    },
    {
      ...card("aerostat", "True Bearing", "teamClearBlind", 2),
      id: "aerostat-true-bearing",
      draw: true,
      artwork: "action.aerostat.true-bearing",
    },
    {
      ...card("aerostat", "Parcel Drop", "createFood", 2),
      id: "aerostat-parcel-drop",
      artwork: "action.aerostat.parcel-drop",
    },
  ],
};
