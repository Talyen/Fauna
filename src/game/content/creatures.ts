import { aerostat } from "./creatures/aerostat";
import { dulcera } from "./creatures/dulcera";
import { arabesca } from "./creatures/arabesca";
import { skybex } from "./creatures/skybex";
import { orifable } from "./creatures/orifable";
import { almanelle } from "./creatures/almanelle";
import { oathara } from "./creatures/oathara";
import { reverie } from "./creatures/reverie";
import { euphera } from "./creatures/euphera";
import { tournelle } from "./creatures/tournelle";
import { memento } from "./creatures/memento";
import { freeze } from "immer";
import type { Species, SpeciesId, CardDefinition } from "./types";
import { rookhaven } from "./creatures/rookhaven";
import { cadenza } from "./creatures/cadenza";
import { stillara } from "./creatures/stillara";
import { neradora } from "./creatures/neradora";
import { sternshell } from "./creatures/sternshell";
import { wickwaltz } from "./creatures/wickwaltz";
import { mossguard } from "./creatures/mossguard";
import { emberback } from "./creatures/emberback";
import { pollenmoth } from "./creatures/pollenmoth";
import { prismram } from "./creatures/prismram";
import { captoad } from "./creatures/captoad";
import { dunefox } from "./creatures/dunefox";
import { reedstag } from "./creatures/reedstag";
import { cindernewt } from "./creatures/cindernewt";
import { coralcurl } from "./creatures/coralcurl";
import { chimecricket } from "./creatures/chimecricket";
import { dawncall } from "./creatures/dawncall";
import { bloomquail } from "./creatures/bloomquail";
import { ringpalm } from "./creatures/ringpalm";
import { shadebrim } from "./creatures/shadebrim";
import { glintstride } from "./creatures/glintstride";
// Catalog order determines seeded offers and selections
const kits = [
  rookhaven,
  cadenza,
  stillara,
  neradora,
  sternshell,
  wickwaltz,
  mossguard,
  emberback,
  pollenmoth,
  prismram,
  captoad,
  dunefox,
  reedstag,
  cindernewt,
  coralcurl,
  chimecricket,
  dawncall,
  bloomquail,
  ringpalm,
  shadebrim,
  glintstride,
  memento,
  euphera,
  tournelle,
  reverie,
  oathara,
  almanelle,
  orifable,
  arabesca,
  skybex,
  dulcera,
  aerostat,
];
freeze(kits, true);
export const SPECIES: readonly Species[] = kits.map((kit) => kit.species);
export const CARDS: readonly CardDefinition[] = [
  rookhaven,
  cadenza,
  stillara,
  neradora,
  sternshell,
  wickwaltz,
  glintstride,
  ringpalm,
  dawncall,
  coralcurl,
  cindernewt,
  reedstag,
  dunefox,
  mossguard,
  emberback,
  pollenmoth,
  prismram,
  captoad,
  chimecricket,
  bloomquail,
  shadebrim,
  memento,
  euphera,
  tournelle,
  reverie,
  oathara,
  almanelle,
  orifable,
  arabesca,
  skybex,
  dulcera,
  aerostat,
].flatMap((kit) => kit.cards);
const speciesById = new Map(SPECIES.map((entry) => [entry.id, entry]));
const cardsBySpecies = new Map<SpeciesId, CardDefinition[]>();
for (const card of CARDS) {
  if (card.species === null) continue;
  const cards = cardsBySpecies.get(card.species);
  if (cards) cards.push(card);
  else cardsBySpecies.set(card.species, [card]);
}
for (const cards of cardsBySpecies.values()) freeze(cards);
/** Shared immutable kits retain the card catalog's order for seeded decisions and slot mapping. */
export function speciesCards(id: SpeciesId): readonly CardDefinition[] {
  return cardsBySpecies.get(id) ?? [];
}
export function species(id: SpeciesId): Species {
  const result = speciesById.get(id);
  if (!result) throw new Error(`Unknown species: ${id}`);
  return result;
}
freeze(SPECIES, true);
freeze(CARDS, true);
