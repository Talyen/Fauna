import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const vitrilo: CreatureKit = {
  species: {
    id: "vitrilo",
    name: "Vitrilo",
    title: "The traveling glassmaker",
    health: 26,
    color: "#e5a74d",
    trait: "Glass Cutter",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Light attacks steal ${amount} Block from the target before dealing damage`,
      effects: [{ kind: "glassCutter", amount }],
    })),
  },
  cards: [
    attack("vitrilo-sunflare-cast", "Sunflare Cast", 6, "light"),
    card("vitrilo-prism-key", "Prism Key", "stealEffect", 1),
    card("vitrilo-kilnheart", "Kilnheart", "heal", 3, {
      target: "self",
      effects: [{ kind: "status", status: "block", amount: 3 }],
    }),
  ],
};
