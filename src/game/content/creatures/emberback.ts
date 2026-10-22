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
    passiveTiers: [
      {
        description: "When your Armor breaks, deal 1 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 1 }],
      },
      {
        description: "When your Armor breaks, deal 2 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 2 }],
      },
      {
        description: "When your Armor breaks, deal 3 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 3 }],
      },
      {
        description: "When your Armor breaks, deal 4 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 4 }],
      },
      {
        description: "When your Armor breaks, deal 5 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 5 }],
      },
      {
        description: "When your Armor breaks, deal 6 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 6 }],
      },
    ],
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
