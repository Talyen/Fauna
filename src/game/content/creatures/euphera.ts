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
    {
      ...attack("euphera", "Twilight Lance", 5, "light"),
      id: "euphera-twilight-lance",
      purgeThorns: true,
      artwork: "action.euphera.twilight-lance",
    },
    {
      ...card("euphera", "Wish Exchange", "redistributeBlock", 1),
      id: "euphera-wish-exchange",
      artwork: "action.euphera.wish-exchange",
    },
    {
      ...card("euphera", "Possible Path", "redraw", 1),
      id: "euphera-possible-path",
      artwork: "action.euphera.possible-path",
    },
  ],
};
