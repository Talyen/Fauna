import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";

export const tournelle: CreatureKit = {
  species: {
    id: "tournelle",
    name: "Tournelle",
    title: "The little gallant",
    health: 30,
    color: "#b7453b",
    trait: "Gallantry",
    passiveTiers: sixPassiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
      description: `${amount}% chance to intercept attacks against a more injured ally`,
      effects: [{ kind: "gallantry", amount }],
    })),
  },
  cards: [
    card("tournelle-teamClearBlind", "Kindled Courage", "teamClearBlind", 1, {
      effects: [{ kind: "drawKeyword", keyword: "light", amount: 1 }],
    }),
    attack("tournelle-attack", "Valiant Challenge", 4, "light", { doubleAgainstHealthier: true }),
    card("tournelle-swapLowest", "Safe Passage", "swapLowest", 1, { effects: [{ kind: "draw", amount: 1 }] }),
  ],
};
