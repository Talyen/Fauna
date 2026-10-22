import { freeze } from "immer";
import { ENCOUNTERS, species, type SpeciesId } from "./content";
import type { GameState } from "./types";

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

function scaleEnemyStat(base: number, encounter: number) {
  return Math.round((base * (10 + encounter)) / 10);
}

/** Authored encounters also support standalone battle fixtures. */
export function encounterSource(game: Pick<GameState, "expedition" | "encounter">): {
  name: string;
  enemies: readonly {
    name: string;
    species: SpeciesId;
    health: number;
    power: number;
  }[];
} {
  const route = game.expedition;
  if (!route) {
    const source = ENCOUNTERS[game.encounter]!;
    return {
      ...source,
      enemies: source.enemies.map((enemy) => ({
        ...enemy,
        health: scaleEnemyStat(enemy.health, game.encounter),
        power: 1 + game.encounter / 10,
      })),
    };
  }
  const pack = route.pack === null ? undefined : encounterPacks(game.encounter)[route.pack];
  if (!pack) throw new Error("Missing encounter pack.");
  const boss = BOSSES.find((entry) => entry.encounter === game.encounter);
  return {
    name: boss ? "Boss" : "Combat",
    enemies: pack.slice(0, Math.min(3, game.encounter + 1)).map((kind, index) => ({
      name: boss && index === 0 ? boss.name : species(kind).name,
      species: kind,
      health: scaleEnemyStat(species(kind).health, game.encounter),
      power: 1 + game.encounter / 10,
    })),
  };
}

export function finalEncounter(game: Pick<GameState, "expedition" | "encounter">) {
  return game.encounter === (game.expedition ? JOURNEY_LENGTH - 1 : 2);
}
export function bossEncounter(game: Pick<GameState, "expedition" | "encounter">) {
  return game.expedition ? BOSSES.some((boss) => boss.encounter === game.encounter) : game.encounter === 2;
}

freeze(COMBAT_PACKS, true);
freeze(BOSSES, true);
