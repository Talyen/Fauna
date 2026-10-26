import { sixPassiveTiers } from "../passive-tiers";
import { card, attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const sternshell: CreatureKit = {
  species: {
    id: "sternshell",
    name: "Sternshell",
    title: "The steadfast voyager",
    health: 32,
    color: "#cb7c45",
    trait: "Shelter",
    passiveTiers: sixPassiveTiers([2, 3, 4, 5, 6, 7], (amount) => ({
      description: `Sternshell starts combat with ${amount} Armor`,
      effects: [{ kind: "battleStart", effect: "armor", amount }],
    })),
  },
  cards: [
    attack("sternshell-attack", "Surge Ram", 3, "physical", { doubleWithArmor: true }),
    card("sternshell-swap", "Siphon Vault", "swap", 1, { effects: [{ kind: "draw", amount: 1 }] }),
    attack("sternshell-spiral-return", "Spiral Return", 1, "water", {
      target: "allEnemies",
      effects: [{ kind: "mana", amount: 1 }],
    }),
  ],
};
