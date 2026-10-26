import { species, speciesCards, type SpeciesId } from "./content";

/** Permanent kit multiplicity is shared by roster slots, enemy decks and save validation. */
export function permanentCardCopies(kind: SpeciesId) {
  return species(kind).legendary ? 2 : 1;
}
export function permanentKitSize(kind: SpeciesId) {
  return speciesCards(kind).length * permanentCardCopies(kind);
}
