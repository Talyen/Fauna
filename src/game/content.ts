import { freeze } from "immer";
import { CARDS } from "./content/cards";
import { SPECIES } from "./content/species";
import type { SpeciesId, CardDefinition } from "./content/types";
export { CARDS } from "./content/cards";
export { SPECIES, species } from "./content/species";
export { ENCOUNTERS } from "./content/encounters";
export type { SpeciesId, Species, PassiveTier, CardDefinition, DamageType } from "./content/types";
export { DAMAGE_LABELS, enemyCard, enemyCanUse, cardText } from "./card-rules";
export const FIRST_RUN_STARTERS: readonly SpeciesId[] = SPECIES.filter((entry) =>
  CARDS.some((card) => card.species === entry.id && card.effect === "attack"),
).map((entry) => entry.id);
export function definition(id: string): CardDefinition {
  const result = CARDS.find((c) => c.id === id);
  if (!result) throw new Error(`Unknown card: ${id}`);
  return result;
}

freeze(FIRST_RUN_STARTERS, true);
