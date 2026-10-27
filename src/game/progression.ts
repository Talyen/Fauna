import type { PassiveKind } from "./content/types";
import {
  TALENTS,
  type TalentId,
  type SpeciesId,
  definition,
  species,
  SPECIES,
  FIRST_RUN_STARTERS,
} from "./content";
import { PROGRESSION_KEYWORDS, definitionKeywords, type ProgressionKeyword } from "./keywords";
export { progressionLabel as keywordLabel } from "./keywords";
import type { Card, GameState } from "./types";
export function collectedSpecies(state: Pick<GameState, "discovery">): SpeciesId[] {
  return SPECIES.filter(({ id }) => state.discovery.recruited[id] !== undefined).map(({ id }) => id);
}
export const MAX_CREATURE_STARS = 5;
export function creatureStars(state: Pick<GameState, "discovery">, kind: SpeciesId): number {
  return Math.max(0, (state.discovery.recruited[kind] ?? 0) - 1);
}
/** Every star rank has a complete replacement passive; enemies always use the base tier. */
export function creaturePassive(state: Pick<GameState, "discovery"> | undefined, kind: SpeciesId) {
  const tiers = species(kind).passiveTiers;
  const rank = state ? creatureStars(state, kind) : 0;
  return { rank, ...tiers[rank]! };
}
/** Sum matching effects in authored order at the current rank; undefined state uses the enemy tier. */
export function passiveAmount(
  state: Pick<GameState, "discovery"> | undefined,
  speciesId: SpeciesId,
  kind: PassiveKind,
): number {
  const rank = state ? creatureStars(state, speciesId) : 0;
  return species(speciesId).passiveTiers[rank]!.effects.reduce(
    (sum, effect) => sum + (effect.kind === kind ? effect.amount : 0),
    0,
  );
}
export const KEYWORDS = PROGRESSION_KEYWORDS;
export type Keyword = ProgressionKeyword;
export type KeywordXP = Partial<Record<Keyword, number>>;
const talentsById = new Map<string, (typeof TALENTS)[number]>(TALENTS.map((talent) => [talent.id, talent]));
const talentsByKeyword = new Map(
  KEYWORDS.map((keyword) => [keyword, TALENTS.filter((talent) => talent.keyword === keyword)]),
);
function hasTalentPrerequisites(state: Pick<GameState, "talents">, talent: (typeof TALENTS)[number]) {
  return talentsByKeyword
    .get(talent.keyword)!
    .every((earlier) => earlier.row >= talent.row || state.talents.includes(earlier.id));
}

/** Validate the complete selection, including purchases restored from a save. */
export function validTalentSelection(state: Pick<GameState, "talents" | "keywordXP">): boolean {
  if (new Set(state.talents).size !== state.talents.length) return false;
  const spent = new Map<Keyword, number>();
  for (const id of state.talents) {
    const talent = talentsById.get(id);
    if (!talent || !hasTalentPrerequisites(state, talent)) return false;
    const points = (spent.get(talent.keyword) ?? 0) + 1;
    if (points > talentPoints(state.keywordXP[talent.keyword] ?? 0)) return false;
    spent.set(talent.keyword, points);
  }
  return true;
}
const keywordsByDefinition = new WeakMap<object, readonly Keyword[]>();
export function cardKeywords(card: Pick<Card, "definitionId">): Keyword[] {
  const def = definition(card.definitionId);
  if (!Object.isFrozen(def)) return definitionKeywords(def);
  let keywords = keywordsByDefinition.get(def);
  if (!keywords) keywordsByDefinition.set(def, (keywords = definitionKeywords(def)));
  return [...keywords];
}
export function xpThreshold(points: number) {
  return 10 * points * (points + 1) - 10 * Math.min(points, 2);
}
export function talentPoints(xp: number) {
  if (!Number.isSafeInteger(xp) || xp < 10) return 0;
  let points = Math.floor((Math.sqrt(1 + 0.4 * (xp + 20)) - 1) / 2);
  while (points > 0 && xpThreshold(points) > xp) points--;
  while (xpThreshold(points + 1) <= xp) points++;
  return points;
}
export function keywordProgress(xp: number) {
  const points = talentPoints(xp),
    start = xpThreshold(points),
    end = xpThreshold(points + 1);
  return { points, current: xp - start, required: end - start };
}
export function hasTalent(state: Pick<GameState, "talents">, id: TalentId) {
  return state.talents.includes(id);
}
export function availablePoints(state: Pick<GameState, "talents" | "keywordXP">, keyword: Keyword) {
  let spent = 0;
  const prefix = `${keyword}.`;
  for (const id of state.talents) if (id.startsWith(prefix)) spent++;
  return Math.max(
    0,
    Math.min(talentPoints(state.keywordXP[keyword] ?? 0), talentsByKeyword.get(keyword)?.length ?? 0) - spent,
  );
}
export function canBuyTalent(state: Pick<GameState, "talents" | "keywordXP">, id: string) {
  const talent = talentsById.get(id);
  return (
    !!talent &&
    !state.talents.includes(id) &&
    availablePoints(state, talent.keyword) > 0 &&
    hasTalentPrerequisites(state, talent)
  );
}

export const STARTER_OFFER_COUNT = 3;
export function starterSpecies(state: Pick<GameState, "discovery">): readonly SpeciesId[] {
  const collected = collectedSpecies(state);
  return collected.length ? collected : FIRST_RUN_STARTERS;
}
export function starterOfferPool(state: Pick<GameState, "discovery" | "selected">): SpeciesId[] {
  return starterSpecies(state).filter(
    (kind) => !state.selected.includes(kind) && (!state.selected.length || !species(kind).legendary),
  );
}

export function starterCount(state: Pick<GameState, "discovery"> & Partial<Pick<GameState, "selected">>) {
  const collected = collectedSpecies(state);
  return collected.length === 0 || state.selected?.some((kind) => species(kind).legendary)
    ? 1
    : Math.max(1, Math.min(3, collected.filter((kind) => !species(kind).legendary).length));
}
