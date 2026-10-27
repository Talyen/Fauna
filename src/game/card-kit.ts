import { species, speciesCards, type SpeciesId } from "./content";

/** Permanent kit multiplicity is shared by roster slots, enemy decks and save validation. */
export function permanentCardCopies(kind: SpeciesId) {
  return species(kind).legendary ? 2 : 1;
}
export function permanentKitSize(kind: SpeciesId) {
  return speciesCards(kind).length * permanentCardCopies(kind);
}

/** Definition order and copy order also determine player slots and seeded boss shuffles. */
export function permanentKit(kind: SpeciesId) {
  const copies = permanentCardCopies(kind);
  const kit: { definition: ReturnType<typeof speciesCards>[number]; copy: number }[] = [];
  for (const definition of speciesCards(kind))
    for (let copy = 0; copy < copies; copy++) kit.push({ definition, copy });
  return kit;
}

const kitCounts = new Map<SpeciesId, ReadonlyMap<string, number>>();

/** Slots can move between piles, but the complete multiset must survive save and resume. */
export function matchesPermanentKit(kind: SpeciesId, ids: readonly string[]) {
  const definitions = speciesCards(kind);
  const copies = permanentCardCopies(kind);
  if (ids.length !== definitions.length * copies) return false;
  let counts = kitCounts.get(kind);
  if (!counts) {
    const authored = new Map<string, number>();
    for (const definition of definitions)
      authored.set(definition.id, (authored.get(definition.id) ?? 0) + copies);
    kitCounts.set(kind, (counts = authored));
  }
  const expected = new Map(counts);
  for (const id of ids) {
    const remaining = expected.get(id) ?? 0;
    if (remaining === 0) return false;
    expected.set(id, remaining - 1);
  }
  return true;
}
