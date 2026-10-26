import { sixPassiveTiers } from "../passive-tiers";
import { attack, card } from "../card-builders";
import type { CreatureKit } from "../types";

export const almanelle: CreatureKit = {
  species: {
    id: "almanelle",
    name: "Almanelle",
    title: "The orchard through the seasons",
    health: 28,
    color: "#d99457",
    trait: "Fallen Leaves",
    passiveTiers: sixPassiveTiers([50, 60, 70, 80, 90, 100], (amount) => ({
      description:
        amount === 100 ? "Decaying Block becomes Thorns" : `${amount}% of decaying Block becomes Thorns`,
      effects: [{ kind: "fallenLeaves", amount }],
    })),
  },
  cards: [
    attack("almanelle-spring-current", "Spring Current", 4, "water", {
      effects: [{ kind: "cleanse", amount: 1 }],
    }),
    card("almanelle-autumn-insight", "Autumn Insight", "recover", 1, {
      target: "ally",
      effects: [{ kind: "heal", amount: 3, target: "recipient" }],
    }),
    card("almanelle-rooted-year", "Rooted Year", "guard", 3, {
      target: "self",
      effects: [{ kind: "status", status: "thorns", amount: 3 }],
    }),
  ],
};
