import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const tithemaw: CreatureKit = {
  species: {
    id: "tithemaw",
    name: "Tithemaw",
    title: "The empire's reckoning",
    legendary: true,
    health: 60,
    color: "#d7b765",
    trait: "The Cost of Shelter",
    passiveTiers: sixPassiveTiers([20, 30, 40, 50, 60, 70], (amount) => ({
      description: `Tithemaw's attacks deal additional damage equal to ${amount}% of the target's Block`,
      effects: [{ kind: "costOfShelter", amount }],
    })),
  },
  cards: [
    attack("tithemaw-coinfang", "Coinfang", 4, "physical", { effects: [{ kind: "purge", amount: 1 }] }),
    card("tithemaw-gilded-ward", "Gilded Ward", "gildedWard", 2),
    attack("tithemaw-oath-howl", "Oath Howl", 2, "light", { target: "allEnemies" }),
  ],
};
