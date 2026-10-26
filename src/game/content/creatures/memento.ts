import { sixPassiveTiers } from "../passive-tiers";
import { card } from "../card-builders";
import type { CreatureKit, CardDefinition } from "../types";
export const memento: CreatureKit = {
  species: {
    id: "memento",
    name: "Memento",
    title: "The palace that remembers",
    legendary: true,
    health: 60,
    color: "#d4a855",
    trait: "The Court Remembers",
    passiveTiers: sixPassiveTiers([3, 4, 5, 6, 7, 8], (amount) => ({
      description: `Each time you play a card, an Echo attacks for ${amount} Water damage`,
      effects: [{ kind: "courtRemembers", amount }],
    })),
  },
  cards: [
    card("memento-lost-procession", "Lost Procession", "procession", 6),
    card("memento-treasury-echo", "Treasury Echo", "createPearls", 2),
    card("memento-drowned-revelation", "Drowned Revelation", "draw", 2),
  ],
};
export const PEARL: CardDefinition = card("memento-pearl", "Pearl", "pearl", 2, { consume: true });
