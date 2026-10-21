import { ENCOUNTERS, species, type DamageType, type SpeciesId } from "./content";
import type { GameState } from "./types";

export const BIOMES = [
  {
    name: "Fernwood",
    combat: [
      ["briartooth", "silkmoth", "mossback"],
      ["briartooth", "mossback", "emberfox"],
      ["mossback", "stormfin", "silkmoth"],
      ["stormfin", "silkmoth", "briartooth"],
      ["emberfox", "briartooth", "mossback"],
      ["emberfox", "mossback", "silkmoth"],
      ["silkmoth", "mossback", "stormfin"],
      ["silkmoth", "emberfox", "briartooth"],
    ],
    boss: ["briartooth", "mossback"],
  },
  {
    name: "Moonwater Marsh",
    combat: [
      ["stormfin", "silkmoth", "mossback"],
      ["stormfin", "stormfin", "briartooth"],
      ["mossback", "briartooth", "stormfin"],
      ["briartooth", "silkmoth", "mossback"],
      ["silkmoth", "emberfox", "stormfin"],
      ["emberfox", "silkmoth", "mossback"],
      ["stormfin", "briartooth", "emberfox"],
      ["silkmoth", "mossback", "briartooth"],
    ],
    boss: ["moonhart"],
  },
] as const;

export function encounterPacks(biome: number, step: number) {
  const content = BIOMES[biome]!;
  return step === 3 ? [content.boss] : content.combat;
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
  const pack = route.pack === null ? undefined : encounterPacks(route.biome, route.step)[route.pack];
  if (!pack) throw new Error("Missing encounter pack.");
  const boss = route.step === 3;
  const ordinary =
    route.biome === 0
      ? { health: 8 + route.step * 5, damage: 2 + route.step }
      : { health: 20 + route.step * 2, damage: 4 };
  const leader = route.biome === 0 ? { health: 36, damage: 5 } : { health: 68, damage: 10 };
  const escort = { health: 18, damage: 3 };
  return {
    name: boss ? "Boss" : "Combat",
    enemies: pack.map((kind, index) => ({
      name:
        boss && index === 0
          ? route.biome === 0
            ? "The Briar Warden"
            : "The Hollow Crown"
          : species(kind).name,
      species: kind,
      ...(boss ? (index === 0 ? leader : escort) : ordinary),
      damageType:
        kind === "emberfox"
          ? "fire"
          : kind === "stormfin"
            ? "lightning"
            : kind === "silkmoth" || kind === "moonhart"
              ? "light"
              : "nature",
    })),
  };
}

export function finalEncounter(game: Pick<GameState, "expedition" | "encounter">) {
  return game.expedition
    ? game.expedition.biome === BIOMES.length - 1 && game.expedition.step === 3
    : game.encounter === 2;
}

export function bossEncounter(game: Pick<GameState, "expedition" | "encounter">) {
  return game.expedition ? game.expedition.step === 3 : game.encounter === 2;
}
