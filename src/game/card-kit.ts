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
  return speciesCards(kind).flatMap((definition) =>
    Array.from({ length: permanentCardCopies(kind) }, (_, copy) => ({ definition, copy })),
  );
}

/** Slots can move between piles, but the complete multiset must survive save and resume. */
export function matchesPermanentKit(kind: SpeciesId, ids: readonly string[]) {
  const expected = permanentKit(kind).map(({ definition }) => definition.id);
  if (ids.length !== expected.length) return false;
  for (const id of ids) {
    const index = expected.indexOf(id);
    if (index < 0) return false;
    expected.splice(index, 1);
  }
  return true;
}
