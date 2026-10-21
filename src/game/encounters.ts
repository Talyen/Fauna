import { ENCOUNTERS, species, type DamageType, type SpeciesId } from "./content";
import type { GameState } from "./types";

export const JOURNEY_LENGTH = 8;
export const COMBAT_PACKS = [
  ["briartooth", "silkmoth", "mossback"],
  ["briartooth", "mossback", "emberfox"],
  ["mossback", "stormfin", "silkmoth"],
  ["stormfin", "silkmoth", "briartooth"],
  ["emberfox", "briartooth", "mossback"],
  ["emberfox", "mossback", "silkmoth"],
  ["silkmoth", "mossback", "stormfin"],
  ["silkmoth", "emberfox", "briartooth"],
  ["stormfin", "silkmoth", "mossback"],
  ["stormfin", "stormfin", "briartooth"],
  ["mossback", "briartooth", "stormfin"],
  ["silkmoth", "emberfox", "stormfin"],
  ["emberfox", "silkmoth", "mossback"],
  ["stormfin", "briartooth", "emberfox"],
  ["silkmoth", "mossback", "briartooth"],
  ["emberback", "mossback", "silkmoth"],
  ["briartooth", "emberback", "stormfin"],
  ["silkmoth", "emberback", "mossback"],
  ["pollenmoth", "briartooth", "stormfin"],
  ["mossback", "pollenmoth", "emberfox"],
] as const;
export const BOSSES = [
  {
    id: "briar-warden",
    encounter: 3,
    name: "The Briar Warden",
    pack: ["briartooth", "mossback", "silkmoth"],
    health: 36,
    damage: 5,
  },
  {
    id: "hollow-crown",
    encounter: 7,
    name: "The Hollow Crown",
    pack: ["moonhart", "stormfin", "silkmoth"],
    health: 68,
    damage: 10,
  },
] as const;
const COMBAT_STATS = [
  { health: 8, damage: 2 },
  { health: 13, damage: 3 },
  { health: 18, damage: 4 },
  null,
  { health: 20, damage: 4 },
  { health: 22, damage: 4 },
  { health: 24, damage: 4 },
  null,
] as const;
export function encounterPacks(encounter: number) {
  const boss = BOSSES.find((entry) => entry.encounter === encounter);
  return boss ? [boss.pack] : COMBAT_PACKS;
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
  if (!route) return ENCOUNTERS[game.encounter]!;
  const pack = route.pack === null ? undefined : encounterPacks(game.encounter)[route.pack];
  if (!pack) throw new Error("Missing encounter pack.");
  const boss = BOSSES.find((entry) => entry.encounter === game.encounter);
  const ordinary = COMBAT_STATS[game.encounter]!;
  const escort = { health: 18, damage: 3 };
  return {
    name: boss ? "Boss" : "Combat",
    enemies: pack.slice(0, Math.min(3, game.encounter + 1)).map((kind, index) => ({
      name: boss && index === 0 ? boss.name : species(kind).name,
      species: kind,
      ...(boss ? (index === 0 ? { health: boss.health, damage: boss.damage } : escort) : ordinary),
      damageType:
        kind === "emberfox"
          ? "burn"
          : kind === "stormfin"
            ? "stun"
            : kind === "silkmoth" || kind === "moonhart" || kind === "pollenmoth"
              ? "light"
              : "nature",
    })),
  };
}

export function finalEncounter(game: Pick<GameState, "expedition" | "encounter">) {
  return game.encounter === (game.expedition ? JOURNEY_LENGTH - 1 : 2);
}
export function bossEncounter(game: Pick<GameState, "expedition" | "encounter">) {
  return game.expedition ? BOSSES.some((boss) => boss.encounter === game.encounter) : game.encounter === 2;
}
