import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const pyrella: CreatureKit = {
  species: {
    id: "pyrella",
    name: "Pyrella",
    title: "The festival spark",
    health: 26,
    color: "#ed8a51",
    trait: "Passing Flame",
    passiveTiers: sixPassiveTiers([20, 35, 50, 65, 80, 100], (amount) => ({
      description:
        amount === 100
          ? "After defeating a Burning enemy, spread its remaining Burn to other enemies"
          : `After defeating a Burning enemy, spread ${amount}% of its remaining Burn to other enemies`,
      effects: [{ kind: "passingFlame", amount }],
    })),
  },
  cards: [
    attack("pyrella-festival-burst", "Festival Burst", 2, "burn", { target: "allEnemies" }),
    card("pyrella-ember-harvest", "Ember Harvest", "mana", 1, {
      restore: true,
      effects: [{ kind: "drawKeyword", keyword: "burn", amount: 1 }],
    }),
    card("pyrella-spark-decoy", "Spark Decoy", "sparkDecoy", 3),
  ],
};
