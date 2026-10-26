import type { Effect, SpeciesId, CardBase, CardDefinition, DamageType } from "./types";

type CardId = `${SpeciesId}-${string}`;
type CardOptions<K extends Effect> = Omit<
  Extract<CardDefinition, { effect: K }>,
  "id" | "species" | "name" | "effect" | "value" | "cost"
>;

// Stable definition IDs own species identity; artwork follows the authored name.
function baseCard(id: CardId, name: string, value: number): CardBase {
  const species = id.slice(0, id.indexOf("-")) as SpeciesId;
  const artworkName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { id, species, name, value, cost: 1, artwork: `action.${species}.${artworkName}` };
}

export const card = <K extends Exclude<Effect, "attack">>(
  id: CardId,
  name: string,
  effect: K,
  value: number,
  options?: CardOptions<K>,
): CardBase & { effect: K } => ({ ...baseCard(id, name, value), effect, ...options });

export const attack = (
  id: CardId,
  name: string,
  value: number,
  damageType: DamageType,
  options?: Omit<CardOptions<"attack">, "damageType">,
): Extract<CardDefinition, { effect: "attack" }> => ({
  ...baseCard(id, name, value),
  effect: "attack",
  damageType,
  ...options,
});
