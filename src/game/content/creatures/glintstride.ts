import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const glintstride: CreatureKit = {
  species: {
    id: "glintstride",
    name: "Glintstride",
    title: "A step beyond the shimmer",
    health: 24,
    color: "#83c9ce",
    trait: "Wrong Foot",
    passiveTiers: [
      {
        description: "Glintstride’s attacks deal 1 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 1 }],
      },
      {
        description: "Glintstride’s attacks deal 2 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 2 }],
      },
      {
        description: "Glintstride’s attacks deal 3 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 3 }],
      },
      {
        description: "Glintstride’s attacks deal 4 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 4 }],
      },
      {
        description: "Glintstride’s attacks deal 5 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 5 }],
      },
      {
        description: "Glintstride’s attacks deal 6 additional Light damage to Blinded enemies",
        effects: [{ kind: "wrongFoot", amount: 6 }],
      },
    ],
  },
  cards: [
    {
      ...attack("glintstride", "Prism Shear", 6, "light"),
      artwork: "action.glintstride.prism-shear",
    },
    {
      ...card("glintstride", "Mirage Run", "dodge", 30),
      effects: [{ kind: "draw", amount: 1 }],
      artwork: "action.glintstride.mirage-run",
    },
    {
      ...card("glintstride", "False Horizon", "teamBlind", 1),
      artwork: "action.glintstride.false-horizon",
    },
  ],
};
