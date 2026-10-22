import { PEARL } from "./content/creatures/memento";
import { freeze } from "immer";
import { CARDS, SPECIES } from "./content/creatures";
import type { SpeciesId, CardDefinition } from "./content/types";
export { CARDS } from "./content/creatures";
export { SPECIES, species } from "./content/creatures";
export { ENCOUNTERS } from "./content/encounters";
export type { SpeciesId, Species, PassiveTier, CardDefinition, DamageType } from "./content/types";
export const FIRST_RUN_STARTERS: readonly SpeciesId[] = SPECIES.filter((entry) =>
  CARDS.some((card) => card.species === entry.id && card.effect === "attack"),
).map((entry) => entry.id);
export function definition(id: string): CardDefinition {
  const result = id === PEARL.id ? PEARL : CARDS.find((c) => c.id === id);
  if (!result) throw new Error(`Unknown card: ${id}`);
  return result;
}

freeze(FIRST_RUN_STARTERS, true);

export { BOONS, type BoonId } from "./content/boons";
export { TALENTS, TALENT_EFFECTS, type TalentId } from "./content/talents";
