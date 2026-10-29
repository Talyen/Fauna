import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const velouria: CreatureKit = {
  species: {
    id: "velouria",
    name: "Velouria",
    title: "The winter masquerade",
    health: 26,
    color: "#8ca9d8",
    trait: "Rimewake",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `When Velouria gains temporary Dodge, deal ${amount} Freeze damage to all enemies`,
      effects: [{ kind: "rimewake", amount }],
    })),
  },
  cards: [
    card("velouria-moonlit-waltz", "Moonlit Waltz", "moonlitWaltz", 30),
    card("velouria-velvet-aegis", "Velvet Aegis", "reflectAlly", 1),
    attack("velouria-hushed-finale", "Hushed Finale", 6, "freeze", { target: "randomEnemy" }),
  ],
};
