import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const velvetmonarch: CreatureKit = {
  species: {
    id: "velvetmonarch",
    name: "Velvetmonarch",
    title: "The garden sovereign",
    legendary: true,
    health: 60,
    color: "#e4bc76",
    trait: "The Garden Answers",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `Summon 2 Royal Blooms with 6 Health on entry; when Velvetmonarch gains Block, each Royal Bloom attacks a random enemy for ${amount} Nature damage`,
      effects: [{ kind: "gardenAnswers", amount }],
    })),
  },
  cards: [
    card("velvetmonarch-royal-repose", "Royal Repose", "royalRepose", 4),
    card("velvetmonarch-meadow-decree", "Meadow Decree", "meadowDecree", 6),
    attack("velvetmonarch-sovereigns-wake", "Sovereign's Wake", 2, "nature", {
      artwork: "action.velvetmonarch.sovereigns-wake",
      target: "allEnemies",
      effects: [{ kind: "blind", amount: 1 }],
    }),
  ],
};
