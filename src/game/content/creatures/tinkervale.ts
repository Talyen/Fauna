import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const tinkervale: CreatureKit = {
  species: {
    id: "tinkervale",
    name: "Tinkervale",
    title: "The ingenious maker",
    health: 28,
    color: "#c49b59",
    trait: "Spare Parts",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `When an ally's Armor is spent, give them ${amount} Block`,
      effects: [{ kind: "spareParts", amount }],
    })),
  },
  cards: [
    card("tinkervale-copper-canopy", "Copper Canopy", "guard", 2, { target: "allAllies" }),
    card("tinkervale-clockwork-launch", "Clockwork Launch", "createBees", 2),
    card("tinkervale-gear-mender", "Gear Mender", "armorAlly", 3),
  ],
};

export const CLOCKWORK_BEE = attack("tinkervale-clockwork-bee", "Clockwork Bee", 6, "physical", {
  consume: true,
});
