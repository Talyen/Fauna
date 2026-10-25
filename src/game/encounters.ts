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
  ["pyrella", "emberback", "prismram"],
  ["mossguard", "pyrella", "captoad"],
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
    name: "Memento",
    pack: ["memento"],
  },
] as const;
export function encounterPacks(encounter: number) {
  const boss = BOSSES.find((entry) => entry.encounter === encounter);
  return boss ? [boss.pack] : COMBAT_PACKS;
}

/** Commit exact species so later roster changes cannot rewrite a battle or its rewards. */
export function generateEncounterPack(state: GameState, savedPack?: readonly SpeciesId[]): SpeciesId[] {
  const packs = encounterPacks(state.encounter);
  const pack = savedPack ?? packs[Math.floor(roll(state) * packs.length)]!;
  const roster = [...state.team, ...state.reserves].map((unit) => unit.species);
  const eligible = SPECIES.filter((entry) => !entry.legendary && !roster.includes(entry.id));
  return pack
    .slice(0, Math.min(3, state.encounter + 1))
    .map((kind) => (roster.includes(kind) ? eligible[Math.floor(roll(state) * eligible.length)]!.id : kind));
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
  const boss = BOSSES.find((entry) => entry.encounter === game.encounter);
  return {
    name: boss ? "Boss" : "Combat",
    enemies: pack.map((kind, index) => ({
      name: boss && index === 0 && kind === boss.pack[0] ? boss.name : species(kind).name,
      species: kind,
      health: scaleEnemyStat(species(kind).health, game.encounter),
      power: 1 + game.encounter / 10,
    })),
  };
}

export function finalEncounter(game: Pick<GameState, "encounter">) {
  return game.encounter === JOURNEY_LENGTH - 1;
}
export function bossEncounter(game: Pick<GameState, "encounter">) {
  return BOSSES.some((boss) => boss.encounter === game.encounter);
}

freeze(COMBAT_PACKS, true);
freeze(BOSSES, true);
