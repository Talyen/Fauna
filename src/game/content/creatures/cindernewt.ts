import { attack } from "../card-builders";
import type { CreatureKit } from "../types";
export const cindernewt: CreatureKit = {
  species: {
    id: "cindernewt",
    name: "Cindernewt",
    title: "The dancing ember",
    health: 24,
    color: "#ed9c65",
    trait: "Cinderstep",
    passiveTiers: [
      {
        description: "When you Dodge, deal 1 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 1 }],
      },
      {
        description: "When you Dodge, deal 2 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 2 }],
      },
      {
        description: "When you Dodge, deal 3 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 3 }],
      },
      {
        description: "When you Dodge, deal 4 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 4 }],
      },
      {
        description: "When you Dodge, deal 5 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 5 }],
      },
      {
        description: "When you Dodge, deal 6 Burn damage to the attacker",
        effects: [{ kind: "dodgeBurn", amount: 6 }],
      },
    ],
  },
  cards: [
    {
      ...attack("cindernewt", "Cinder Lash", 6, "physical"),
      alternateDamageType: "burn",
      artwork: "action.cindernewt.cinder-lash",
    },
    {
      ...attack("cindernewt", "Ember Breath", 1, "burn"),
      id: "cindernewt-ember-breath",
      target: "allEnemies",
      effects: [{ kind: "meltArmor", amount: 50 }],
      artwork: "action.cindernewt.ember-breath",
    },
    {
      ...attack("cindernewt", "Ashen Veil", 1, "burn"),
      id: "cindernewt-ashen-veil",
      target: "allEnemies",
      effects: [{ kind: "blind", amount: 1 }],
      artwork: "action.cindernewt.ashen-veil",
    },
  ],
};
