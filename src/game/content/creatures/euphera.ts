import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const euphera: CreatureKit = {
  species: {
    id: "euphera",
    name: "Euphera",
    title: "A wish taking flight",
    health: 26,
    color: "#e7bd79",
    trait: "Good Fortune",
    passiveTiers: sixPassiveTiers([10, 20, 30, 40, 50, 60], (amount) => ({
      description: `Failed allied chance effects have a ${amount}% chance to reroll once`,
      effects: [{ kind: "goodFortune", amount }],
    })),
  },
  cards: [
    attack("euphera-twilight-lance", "Twilight Lance", 5, "light", { purgeThorns: true }),
    card("euphera-wish-exchange", "Wish Exchange", "redistributeBlock", 1),
    card("euphera-possible-path", "Possible Path", "redraw", 1),
  ],
};
