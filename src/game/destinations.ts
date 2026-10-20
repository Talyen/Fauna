import { ENCOUNTERS, species, type DamageType, type SpeciesId } from "./content";
import type { GameState } from "./types";

export const BIOMES = [
  {
    name: "Fernwood",
    locations: ["briar-hollow", "mossy-stream", "ember-grove", "silken-clearing"],
    boss: "hollow-heart",
  },
  {
    name: "Moonwater Marsh",
    locations: ["reed-banks", "flooded-grove", "firefly-pool", "mist-island"],
    boss: "moonwell",
  },
] as const;

export const LOCATIONS: readonly {
  id: string;
  name: string;
  packs: readonly (readonly SpeciesId[])[];
}[] = [
  {
    id: "briar-hollow",
    name: "Briar Hollow",
    packs: [
      ["briartooth", "silkmoth", "mossback"],
      ["briartooth", "mossback", "emberfox"],
    ],
  },
  {
    id: "mossy-stream",
    name: "Mossy Stream",
    packs: [
      ["mossback", "stormfin", "silkmoth"],
      ["stormfin", "silkmoth", "briartooth"],
    ],
  },
  {
    id: "ember-grove",
    name: "Ember Grove",
    packs: [
      ["emberfox", "briartooth", "mossback"],
      ["emberfox", "mossback", "silkmoth"],
    ],
  },
  {
    id: "silken-clearing",
    name: "Silken Clearing",
    packs: [
      ["silkmoth", "mossback", "stormfin"],
      ["silkmoth", "emberfox", "briartooth"],
    ],
  },
  { id: "hollow-heart", name: "Hollow Heart", packs: [["briartooth", "mossback"]] },
  {
    id: "reed-banks",
    name: "Reed Banks",
    packs: [
      ["stormfin", "silkmoth", "mossback"],
      ["stormfin", "stormfin", "briartooth"],
    ],
  },
  {
    id: "flooded-grove",
    name: "Flooded Grove",
    packs: [
      ["mossback", "briartooth", "stormfin"],
      ["briartooth", "silkmoth", "mossback"],
    ],
  },
  {
    id: "firefly-pool",
    name: "Firefly Pool",
    packs: [
      ["silkmoth", "emberfox", "stormfin"],
      ["emberfox", "silkmoth", "mossback"],
    ],
  },
  {
    id: "mist-island",
    name: "Mist Island",
    packs: [
      ["stormfin", "briartooth", "emberfox"],
      ["silkmoth", "mossback", "briartooth"],
    ],
  },
  { id: "moonwell", name: "Moonwell", packs: [["moonhart"]] },
];

export function location(id: string) {
  return LOCATIONS.find((entry) => entry.id === id);
}

/** Authored legacy encounters stay stable so existing expeditions can finish unchanged. */
export function encounterSource(
  game: Pick<GameState, "expedition" | "encounter">,
  destination?: string,
): {
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
  const offer = route.offers.find((entry) => entry.location === (destination ?? route.chosen));
  const place = offer && location(offer.location);
  const pack = offer && place?.packs[offer.pack];
  if (!place || !pack) throw new Error("Unknown destination offer.");
  const boss = route.step === 3;
  const ordinary =
    route.biome === 0
      ? { health: 8 + route.step * 5, damage: 2 + route.step }
      : { health: 20 + route.step * 2, damage: 4 };
  const leader = route.biome === 0 ? { health: 36, damage: 5 } : { health: 68, damage: 10 };
  const companion = { health: 18, damage: 3 };
  return {
    name: place.name,
    enemies: pack.map((kind, index) => ({
      name:
        boss && index === 0
          ? route.biome === 0
            ? "The Briar Warden"
            : "The Hollow Crown"
          : species(kind).name,
      species: kind,
      ...(boss ? (index === 0 ? leader : companion) : ordinary),
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
