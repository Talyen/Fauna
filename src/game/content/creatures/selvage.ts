import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const selvage: CreatureKit = {
  species: {
    id: "selvage",
    name: "Selvage",
    title: "The song of broken things",
    health: 26,
    color: "#d78753",
    trait: "Mend the Broken",
    passiveTiers: sixPassiveTiers([2, 3, 4, 5, 6, 7], (amount) => ({
      description: `Selvage’s healing abilities can revive an ally with up to ${amount} Health`,
      effects: [{ kind: "mendTheBroken", amount }],
    })),
  },
  cards: [
    attack("selvage-gust-wing", "Gust Wing", 2, "physical", { target: "allEnemies" }),
    card("selvage-nest-ward", "Nest Ward", "guard", 2, { target: "allAllies" }),
    card("selvage-mending-song", "Mending Song", "heal", 6, { target: "mostInjured" }),
  ],
};
