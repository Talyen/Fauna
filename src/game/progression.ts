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
  const collected: SpeciesId[] = [];
  for (const { id } of SPECIES) if (state.discovery.recruited[id] !== undefined) collected.push(id);
  return collected;
}
export const MAX_CREATURE_STARS = 5;
export function creatureStars(state: Pick<GameState, "discovery">, kind: SpeciesId): number {
  return Math.max(0, (state.discovery.recruited[kind] ?? 0) - 1);
}
/** Read the authored tier without allocating a ranked presentation object. */
export function creaturePassiveTier(state: Pick<GameState, "discovery"> | undefined, kind: SpeciesId) {
  return species(kind).passiveTiers[state ? creatureStars(state, kind) : 0]!;
}
/** Every star rank has a complete replacement passive; enemies always use the base tier. */
export function creaturePassive(state: Pick<GameState, "discovery"> | undefined, kind: SpeciesId) {
  const rank = state ? creatureStars(state, kind) : 0;
  return { rank, ...species(kind).passiveTiers[rank]! };
}
// Only the deeply frozen authored catalog is safe to cache; injected tiers may be mutable.
const authoredPassiveTiers = new WeakSet(SPECIES.flatMap((entry) => entry.passiveTiers));
const passiveAmounts = new WeakMap<object, Map<PassiveKind, number>>();
/** Sum matching effects in authored order at the current rank; undefined state uses the enemy tier. */
export function passiveAmount(
  state: Pick<GameState, "discovery"> | undefined,
  speciesId: SpeciesId,
  kind: PassiveKind,
): number {
  const rank = state ? creatureStars(state, speciesId) : 0;
  const tier = species(speciesId).passiveTiers[rank]!;
  let amounts = passiveAmounts.get(tier);
  const cached = amounts?.get(kind);
  if (cached !== undefined) return cached;
  const amount = tier.effects.reduce((sum, effect) => sum + (effect.kind === kind ? effect.amount : 0), 0);
  if (authoredPassiveTiers.has(tier)) {
    if (!amounts) passiveAmounts.set(tier, (amounts = new Map()));
    amounts.set(kind, amount);
  }
  return amount;
}
export const KEYWORDS = PROGRESSION_KEYWORDS;
export type Keyword = ProgressionKeyword;
export type KeywordXP = Partial<Record<Keyword, number>>;
const talentsById = new Map<string, (typeof TALENTS)[number]>(TALENTS.map((talent) => [talent.id, talent]));
const talentsByKeyword = new Map(
  KEYWORDS.map((keyword) => [keyword, TALENTS.filter((talent) => talent.keyword === keyword)]),
);
function hasTalentPrerequisites(
  state: Pick<GameState, "talents">,
  talent: (typeof TALENTS)[number],
  selected?: ReadonlySet<string>,
) {
  return talentsByKeyword
    .get(talent.keyword)!
    .every(
      (earlier) =>
        earlier.row >= talent.row ||
        (selected ? selected.has(earlier.id) : state.talents.includes(earlier.id)),
    );
}

/** Validate the complete selection, including purchases restored from a save. */
export function validTalentSelection(state: Pick<GameState, "talents" | "keywordXP">): boolean {
  if (!state.talents.length) return true;
  const selected = new Set(state.talents);
  if (selected.size !== state.talents.length) return false;
  const spent = new Map<Keyword, number>();
  for (const id of state.talents) {
    const talent = talentsById.get(id);
    if (!talent || !hasTalentPrerequisites(state, talent, selected)) return false;
    const points = (spent.get(talent.keyword) ?? 0) + 1;
    if (points > talentPoints(state.keywordXP[talent.keyword] ?? 0)) return false;
    spent.set(talent.keyword, points);
  }
  return true;
}
const keywordsByDefinition = new WeakMap<object, readonly Keyword[]>();
function definitionCardKeywords(card: Pick<Card, "definitionId">): readonly Keyword[] {
  const def = definition(card.definitionId);
  if (!Object.isFrozen(def)) return definitionKeywords(def);
  let keywords = keywordsByDefinition.get(def);
  if (!keywords) keywordsByDefinition.set(def, (keywords = definitionKeywords(def)));
  return keywords;
}
/** Return a mutable copy to callers that need the full list. */
export function cardKeywords(card: Pick<Card, "definitionId">): Keyword[] {
  return [...definitionCardKeywords(card)];
}
/** Membership checks do not need a defensive array copy. */
export function cardHasKeyword(card: Pick<Card, "definitionId">, keyword: Keyword): boolean {
  return definitionCardKeywords(card).includes(keyword);
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
  const pool = starterSpecies(state);
  if (!state.selected.length) return [...pool];
  return pool.filter((kind) => !state.selected.includes(kind) && !species(kind).legendary);
}

export function starterCount(state: Pick<GameState, "discovery"> & Partial<Pick<GameState, "selected">>) {
  if (state.selected?.some((kind) => species(kind).legendary)) return 1;
  const collected = collectedSpecies(state);
  if (collected.length === 0) return 1;
  let count = 0;
  for (const kind of collected) if (!species(kind).legendary && ++count === 3) return 3;
  return Math.max(1, count);
}
