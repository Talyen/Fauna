import { sixPassiveTiers } from "../passive-tiers";
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
    passiveTiers: sixPassiveTiers([1, 2, 3, 4, 5, 6], (amount) => ({
      description: `When you Dodge, deal ${amount} Burn damage to the attacker`,
      effects: [{ kind: "dodgeBurn", amount }],
    })),
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
