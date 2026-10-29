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
export function generateEncounterPack(state: GameState): SpeciesId[] {
  const size = bossEncounter(state) ? 1 : Math.min(3, state.encounter + 1);
  const roster = new Set([...state.team, ...state.reserves].map((unit) => unit.species));
  const seen = new Set(state.journey?.encounteredEnemies ?? []);
  if (bossEncounter(state)) {
    const unowned = legendarySpecies.filter((entry) => !roster.has(entry.id));
    const eligible = unowned.length ? unowned : legendarySpecies;
    const unseen = eligible.filter((entry) => !seen.has(entry.id));
    const choices = unseen.length ? unseen : eligible;
    return [choices[Math.floor(roll(state) * choices.length)]!.id];
  }

  const eligible = recruitableSpecies.filter((entry) => !roster.has(entry.id));
  // Counts represent unseen attackers, unseen support, seen attackers, and seen support.
  const category = (id: SpeciesId) => (seen.has(id) ? 2 : 0) + (offensiveSpecies.has(id) ? 0 : 1);
  const counts = [0, 0, 0, 0];
  for (const entry of eligible) counts[category(entry.id)]!++;
  const required = size > 1 ? 2 : 0;
  const memo = new Map<string, { unseen: number; ways: number }>();
  // Count valid completions that maximize unseen species; retain equal probability for each lineup.
  function completions(remaining: number, needed: number): { unseen: number; ways: number } {
    if (!remaining) return { unseen: 0, ways: needed <= 0 ? 1 : 0 };
    if (needed > remaining) return { unseen: 0, ways: 0 };
    const key = `${remaining}:${Math.max(0, needed)}:${counts.join(",")}`;
    const cached = memo.get(key);
    if (cached) return cached;
    let best = -1;
    let ways = 0;
    for (let group = 0; group < counts.length; group++) {
      const available = counts[group]!;
      if (!available) continue;
      counts[group]!--;
      const next = completions(remaining - 1, needed - Number(group % 2 === 0));
      counts[group]!++;
      if (!next.ways) continue;
      const unseen = next.unseen + Number(group < 2);
      if (unseen > best) {
        best = unseen;
        ways = 0;
      }
      if (unseen === best) ways += available * next.ways;
    }
    const result = { unseen: best, ways };
    memo.set(key, result);
    return result;
  }
  const selected: SpeciesId[] = [];
  let needed = required;
  for (let index = 0; index < size; index++) {
    const remaining = size - index - 1;
    const best = completions(size - index, needed);
    if (!best.ways) throw new Error("No valid encounter pool.");
    let choice = roll(state) * best.ways;
    for (let position = 0; position < eligible.length; position++) {
      const entry = eligible[position]!;
      const group = category(entry.id);
      counts[group]!--;
      const next = completions(remaining, needed - Number(group % 2 === 0));
      const weight = next.unseen + Number(group < 2) === best.unseen ? next.ways : 0;
      choice -= weight;
      if (choice < 0) {
        selected.push(entry.id);
        eligible.splice(position, 1);
        needed -= Number(group % 2 === 0);
        break;
      }
      counts[group]!++;
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
