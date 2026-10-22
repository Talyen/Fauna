import { ENCOUNTERS, species, type DamageType, type SpeciesId } from "./content";
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
] as const;
export const BOSSES = [
  {
    id: "briar-warden",
    encounter: 3,
    name: "The Briar Warden",
    pack: ["emberback", "mossguard", "pollenmoth"],
    damage: 5,
  },
  {
    id: "hollow-crown",
    encounter: 7,
    name: "The Hollow Crown",
    pack: ["prismram", "emberback", "pollenmoth"],
    damage: 10,
  },
] as const;
const COMBAT_DAMAGE = [2, 3, 4, null, 4, 4, 4, null] as const;
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
    damage: number;
    damageType: DamageType;
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
        damage: scaleEnemyStat(enemy.damage, game.encounter),
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
      damage: scaleEnemyStat(
        boss ? (index === 0 ? boss.damage : 3) : COMBAT_DAMAGE[game.encounter]!,
        game.encounter,
      ),
      damageType:
        kind === "shadebrim"
          ? "freeze"
          : kind === "chimecricket" || kind === "ringpalm"
            ? "stun"
            : kind === "coralcurl" || kind === "sternshell"
              ? "water"
              : kind === "dunefox"
                ? "physical"
                : kind === "emberback" || kind === "cindernewt" || kind === "wickwaltz"
                  ? "burn"
                  : kind === "captoad"
                    ? "poison"
                    : kind === "mossguard" || kind === "reedstag"
                      ? "nature"
                      : "light",
    })),
  };
}

export function finalEncounter(game: Pick<GameState, "expedition" | "encounter">) {
  return game.encounter === (game.expedition ? JOURNEY_LENGTH - 1 : 2);
}
export function bossEncounter(game: Pick<GameState, "expedition" | "encounter">) {
  return game.expedition ? BOSSES.some((boss) => boss.encounter === game.encounter) : game.encounter === 2;
}
