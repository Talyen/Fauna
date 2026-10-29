import { freeze } from "immer";
import { SPECIES, species, speciesCards, type CardDefinition, type SpeciesId } from "./content";
import type { GameState } from "./types";
import { roll } from "./random";
import { enemyCanUse, enemyCard } from "./card-rules";

const ACT_COUNT = 3;
export const ROOMS_PER_ACT = 10;
export const JOURNEY_LENGTH = ACT_COUNT * ROOMS_PER_ACT;
export const BOSSES = [
  {
    id: "briar-warden",
    encounter: 9,
    name: "Memento",
    pack: ["memento"],
  },
  {
    id: "garden-court",
    encounter: 19,
    name: "Velvetmonarch",
    pack: ["velvetmonarch"],
  },
  {
    id: "hollow-crown",
    encounter: 29,
    name: "Chronora",
    pack: ["chronora"],
  },
] as const;
const recruitableSpecies = SPECIES.filter((entry) => !entry.legendary);
const bossesByEncounter = new Map<number, (typeof BOSSES)[number]>(
  BOSSES.map((boss) => [boss.encounter, boss]),
);
const legendarySpecies = SPECIES.filter((entry) => entry.legendary);
export function dealsDamage(card: CardDefinition): boolean {
  if (!enemyCanUse(card)) return false;
  const enemyAbility = enemyCard(card);
  return (
    enemyAbility.effect === "attack" ||
    enemyAbility.effects?.some((effect) => effect.kind === "damage") === true
  );
}

const offensiveSpecies = new Set(
  recruitableSpecies.filter((entry) => speciesCards(entry.id).some(dealsDamage)).map((entry) => entry.id),
);

/** Commit exact species so later roster changes cannot rewrite a battle or its rewards. */
export function generateEncounterPack(state: GameState, savedPack?: readonly SpeciesId[]): SpeciesId[] {
  const size = bossEncounter(state) ? 1 : Math.min(3, state.encounter + 1);
  const roster = new Set([...state.team, ...state.reserves].map((unit) => unit.species));
  if (bossEncounter(state)) {
    const unowned = legendarySpecies.filter((entry) => !roster.has(entry.id));
    const eligible = unowned.length ? unowned : legendarySpecies;
    const saved = savedPack?.[0];
    return saved && eligible.some((entry) => entry.id === saved)
      ? [saved]
      : [eligible[Math.floor(roll(state) * eligible.length)]!.id];
  }
  const eligible = recruitableSpecies.filter((entry) => !roster.has(entry.id));
  if (savedPack) {
    return savedPack
      .slice(0, size)
      .map((id) => (roster.has(id) ? eligible[Math.floor(roll(state) * eligible.length)]!.id : id));
  }

  const offensiveCount = eligible.filter((entry) => offensiveSpecies.has(entry.id)).length;
  const otherCount = eligible.length - offensiveCount;
  const required = size > 1 ? 2 : 0;
  if (!eligible.length || (required && !offensiveCount)) throw new Error("No valid encounter pool.");
  // Weight each choice by its number of valid completions, so every valid lineup is equally likely.
  function completions(remaining: number, needed: number): number {
    if (remaining === 0) return needed <= 0 ? 1 : 0;
    if (needed > remaining) return 0;
    return (
      offensiveCount * completions(remaining - 1, needed - 1) +
      otherCount * completions(remaining - 1, needed)
    );
  }
  const selected: SpeciesId[] = [];
  let needed = required;
  for (let index = 0; index < size; index++) {
    const remaining = size - index - 1;
    const offensiveWeight = completions(remaining, needed - 1);
    const otherWeight = completions(remaining, needed);
    let choice = roll(state) * (offensiveCount * offensiveWeight + otherCount * otherWeight);
    for (const entry of eligible) {
      const offensive = offensiveSpecies.has(entry.id);
      choice -= offensive ? offensiveWeight : otherWeight;
      if (choice < 0) {
        selected.push(entry.id);
        if (offensive) needed--;
        break;
      }
    }
  }
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

freeze(BOSSES, true);
