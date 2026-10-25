import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const parhelion: CreatureKit = {
  species: {
    id: "parhelion",
    name: "Parhelion",
    title: "The sun upon the snow",
    health: 26,
    color: "#e4bc68",
    trait: "Sunthaw",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Cleansing Freeze build-up restores ${amount} Health`,
      effects: [{ kind: "sunthaw", amount }],
    })),
  },
  cards: [
    {
      ...card("parhelion", "Polar Reprieve", "teamThaw", 1),
      id: "parhelion-polar-reprieve",
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.parhelion.polar-reprieve",
    },
    {
      ...card("parhelion", "Sundog Reservoir", "mana", 2),
      id: "parhelion-sundog-reservoir",
      artwork: "action.parhelion.sundog-reservoir",
    },
    {
      ...attack("parhelion", "Whiteout Waltz", 1, "freeze"),
      id: "parhelion-whiteout-waltz",
      effects: [{ kind: "blind", amount: 1 }],
      artwork: "action.parhelion.whiteout-waltz",
    },
  ],
};
