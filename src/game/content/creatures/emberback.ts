import { sixPassiveTiers } from "../passive-tiers";
import { attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const emberback: CreatureKit = {
  species: {
    id: "emberback",
    name: "Emberback",
    title: "The banked furnace",
    health: 30,
    color: "#ed9c65",
    trait: "Molten Shell",
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `When your Armor breaks, deal ${amount} Burn damage to all enemies`,
      effects: [{ kind: "armorBreak", amount }],
    })),
  },
  cards: [
    {
      ...attack("emberback", "Ember Charge", 4, "physical"),
      artwork: "action.emberback.ember-charge",
      effects: [{ kind: "status", status: "armor", amount: 2 }],
    },
    {
      ...attack("emberback", "Furnace Breath", 2, "burn"),
      id: "emberback-furnace-breath",
      artwork: "action.emberback.furnace-breath",
      target: "allEnemies",
    },
    {
      ...attack("emberback", "Magma Stomp", 2, "stun"),
      id: "emberback-magma-stomp",
      artwork: "action.emberback.magma-stomp",
      target: "allEnemies",
    },
  ],
};
