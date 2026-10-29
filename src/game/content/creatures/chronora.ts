import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const chronora: CreatureKit = {
  species: {
    id: "chronora",
    name: "Chronora",
    title: "The keeper of borrowed moments",
    legendary: true,
    health: 60,
    color: "#d4a855",
    trait: "Turn Back the Tide",
    passiveTiers: sixPassiveTiers([50, 60, 70, 80, 90, 100], (amount) => ({
      description: `Summon 2 Pendulums with 6 Health on entry; each adds 1 attack damage; Chronora’s next attack has ${amount === 80 ? "an" : "a"} ${amount}% chance to repeat after restoring Health`,
      effects: [{ kind: "turnBackTide", amount }],
    })),
  },
  cards: [
    card("chronora-borrowed-moment", "Borrowed Moment", "teamNegate", 1),
    attack("chronora-pendulum-break", "Pendulum Break", 4, "stun"),
    card("chronora-bridge-rewind", "Bridge Rewind", "bridgeRewind", 4),
  ],
};
