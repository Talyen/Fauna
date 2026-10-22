import type { Effect, SpeciesId, CardBase, CardDefinition, DamageType } from "./types";
export const card = <T extends Exclude<Effect, "attack">>(
  species: SpeciesId,
  name: string,
  effect: T,
  value: number,
): CardBase & { effect: T } => ({
  id: `${species}-${effect}`,
  species,
  name,
  effect,
  value,
  cost: 1,
});
export const attack = (
  species: SpeciesId,
  name: string,
  value: number,
  damageType: DamageType,
): Extract<CardDefinition, { effect: "attack" }> => ({
  id: `${species}-attack`,
  species,
  name,
  effect: "attack",
  value,
  cost: 1,
  damageType,
});
