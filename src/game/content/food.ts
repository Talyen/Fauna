import { freeze } from "immer";
import type { CardDefinition } from "./types";

/** Shared consumables have no species, level progression or creature owner. */
export const FOOD_CARDS: readonly CardDefinition[] = freeze(
  [
    {
      id: "food-apple",
      species: null,
      name: "Apple",
      effect: "heal",
      value: 6,
      cost: 1,
      consume: true,
      artwork: "food.apple",
    },
    {
      id: "food-mana-berries",
      species: null,
      name: "Mana Berries",
      effect: "mana",
      value: 2,
      cost: 1,
      consume: true,
      artwork: "food.mana-berries",
    },
    {
      id: "food-trail-bread",
      species: null,
      name: "Trail Bread",
      effect: "guard",
      value: 6,
      cost: 1,
      consume: true,
      artwork: "food.trail-bread",
    },
  ] satisfies CardDefinition[],
  true,
);

export function isFood(id: string): boolean {
  return FOOD_CARDS.some((card) => card.id === id);
}
