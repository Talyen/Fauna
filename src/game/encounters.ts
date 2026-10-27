import { freeze } from "immer";
import { SPECIES, species, type SpeciesId } from "./content";
import type { GameState } from "./types";
import { roll } from "./random";

export const JOURNEY_LENGTH = 8;
export const COMBAT_PACKS = [
  ["emberback", "pollenmoth", "mossguard"],
  ["mossguard", "prismram", "pollenmoth"],
  ["pollenmoth", "emberback", "prismram"],
  ["prismram", "mossguard", "emberback"],
  ["emberback", "emberback", "mossguard"],
  ["pollenmoth", "pollenmoth", "emberback"],
  ["prismram", "prismram", "emberback"],
  ["prismram", "emberback", "pollenmoth"],
  ["dunefox", "mossguard", "pollenmoth"],
  ["captoad", "dunefox", "prismram"],
  ["reedstag", "captoad", "pollenmoth"],
  ["prismram", "reedstag", "emberback"],
  ["captoad", "mossguard", "pollenmoth"],
  ["prismram", "captoad", "emberback"],
  ["chimecricket", "dunefox", "mossguard"],
  ["prismram", "chimecricket", "captoad"],
  ["cindernewt", "dunefox", "mossguard"],
  ["prismram", "cindernewt", "pollenmoth"],
  ["coralcurl", "reedstag", "prismram"],
  ["mossguard", "coralcurl", "captoad"],
  ["dawncall", "reedstag", "prismram"],
  ["mossguard", "dawncall", "captoad"],
  ["bloomquail", "emberback", "prismram"],
  ["mossguard", "bloomquail", "captoad"],
  ["shadebrim", "emberback", "prismram"],
  ["mossguard", "shadebrim", "captoad"],
  ["ringpalm", "dawncall", "prismram"],
  ["mossguard", "ringpalm", "captoad"],
  ["glintstride", "dunefox", "prismram"],
  ["mossguard", "glintstride", "captoad"],
  ["sternshell", "coralcurl", "prismram"],
  ["mossguard", "sternshell", "captoad"],
  ["wickwaltz", "shadebrim", "prismram"],
  ["mossguard", "wickwaltz", "captoad"],
  ["neradora", "coralcurl", "prismram"],
  ["mossguard", "neradora", "captoad"],
  ["stillara", "emberback", "prismram"],
  ["mossguard", "stillara", "captoad"],
  ["rookhaven", "emberback", "prismram"],
  ["mossguard", "rookhaven", "captoad"],
  ["cadenza", "emberback", "prismram"],
  ["mossguard", "cadenza", "captoad"],
  ["euphera", "emberback", "prismram"],
  ["mossguard", "euphera", "captoad"],
  ["tournelle", "emberback", "prismram"],
  ["mossguard", "tournelle", "captoad"],
  ["reverie", "emberback", "prismram"],
  ["mossguard", "reverie", "captoad"],
  ["oathara", "emberback", "prismram"],
  ["mossguard", "oathara", "captoad"],
  ["almanelle", "emberback", "prismram"],
  ["mossguard", "almanelle", "captoad"],
  ["orifable", "emberback", "prismram"],
  ["mossguard", "orifable", "captoad"],
  ["arabesca", "emberback", "prismram"],
  ["mossguard", "arabesca", "captoad"],
  ["skybex", "emberback", "prismram"],
  ["mossguard", "skybex", "captoad"],
  ["dulcera", "emberback", "prismram"],
  ["mossguard", "dulcera", "captoad"],
  ["parhelion", "stillara", "prismram"],
  ["mossguard", "parhelion", "captoad"],
  ["pyrella", "emberback", "prismram"],
  ["mossguard", "pyrella", "captoad"],
  ["aerostat", "emberback", "prismram"],
  ["mossguard", "aerostat", "captoad"],
  ["wisterelle", "emberback", "prismram"],
  ["mossguard", "wisterelle", "captoad"],
] as const;
export const BOSSES = [
  {
    id: "briar-warden",
    encounter: 3,
    name: "Memento",
    pack: ["memento"],
  },
  {
    id: "hollow-crown",
    encounter: 7,
    name: "Ravelland",
    pack: ["ravelland"],
  },
] as const;
const recruitableSpecies = SPECIES.filter((entry) => !entry.legendary);
const bossesByEncounter = new Map<number, (typeof BOSSES)[number]>(
  BOSSES.map((boss) => [boss.encounter, boss]),
);
export function encounterPacks(encounter: number) {
  const boss = bossesByEncounter.get(encounter);
  return boss ? [boss.pack] : COMBAT_PACKS;
}

/** Commit exact species so later roster changes cannot rewrite a battle or its rewards. */
export function generateEncounterPack(state: GameState, savedPack?: readonly SpeciesId[]): SpeciesId[] {
  let pack = savedPack;
  if (!pack) {
    const packs = encounterPacks(state.encounter);
    pack = packs[Math.floor(roll(state) * packs.length)]!;
  }
  const selected = pack.slice(0, Math.min(3, state.encounter + 1));
  const inRoster = (kind: SpeciesId) =>
    state.team.some((unit) => unit.species === kind) || state.reserves.some((unit) => unit.species === kind);
  if (!selected.some(inRoster)) return selected;
  const roster = new Set<SpeciesId>();
  for (const unit of state.team) roster.add(unit.species);
  for (const unit of state.reserves) roster.add(unit.species);
  const eligible = recruitableSpecies.filter((entry) => !roster.has(entry.id));
  for (let index = 0; index < selected.length; index++)
    if (roster.has(selected[index]!))
      selected[index] = eligible[Math.floor(roll(state) * eligible.length)]!.id;
  return selected;
}

function scaleEnemyStat(base: number, encounter: number) {
  return Math.round((base * (10 + encounter)) / 10);
}

/** Resolve the committed encounter pack without consuming randomness. */
export function encounterSource(game: Pick<GameState, "expedition" | "encounter">): {
  name: string;
  enemies: readonly {
    name: string;
    species: SpeciesId;
    health: number;
    power: number;
  }[];
} {
  const pack = game.expedition.pack;
  if (!pack) throw new Error("Missing encounter pack.");
  const boss = bossesByEncounter.get(game.encounter);
  const power = 1 + game.encounter / 10;
  return {
    name: boss ? "Boss" : "Combat",
    enemies: pack.map((kind, index) => {
      const entry = species(kind);
      return {
        name: boss && index === 0 && kind === boss.pack[0] ? boss.name : entry.name,
        species: kind,
        health: scaleEnemyStat(entry.health, game.encounter),
        power,
      };
    }),
  };
}

export function finalEncounter(game: Pick<GameState, "encounter">) {
  return game.encounter === JOURNEY_LENGTH - 1;
}
export function bossEncounter(game: Pick<GameState, "encounter">) {
  return bossesByEncounter.has(game.encounter);
}

freeze(COMBAT_PACKS, true);
freeze(BOSSES, true);
