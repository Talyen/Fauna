import { FOOD_CARDS } from "./content/food";
export { FOOD_CARDS } from "./content/food";
import { PEARL } from "./content/creatures/memento";
import { freeze } from "immer";
import { CARDS } from "./content/creatures";
import type { SpeciesId, CardDefinition } from "./content/types";
export { CARDS } from "./content/creatures";
export { SPECIES, species, speciesCards } from "./content/creatures";
export type { SpeciesId, Species, PassiveTier, CardDefinition, DamageType } from "./content/types";
// Curate solo openings separately from kits that shine after recruitment.
export const FIRST_RUN_STARTERS: readonly SpeciesId[] = [
  "sternshell",
  "wickwaltz",
  "emberback",
  "prismram",
  "captoad",
  "dunefox",
  "reedstag",
  "cindernewt",
  "coralcurl",
  "chimecricket",
  "ringpalm",
  "glintstride",
  "euphera",
  "tournelle",
];
const cardsById = new Map([...CARDS, ...FOOD_CARDS].map((card) => [card.id, card]));
export function definition(id: string): CardDefinition {
  const result = id === PEARL.id ? PEARL : cardsById.get(id);
  if (!result) throw new Error(`Unknown card: ${id}`);
  return result;
}

freeze(FIRST_RUN_STARTERS, true);

export { BOONS, type BoonId } from "./content/boons";
export { TALENTS, type TalentId } from "./content/talents";
