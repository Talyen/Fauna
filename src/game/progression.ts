import { TALENTS, type TalentId } from "./content/talents";
export { TALENTS, TALENT_EFFECTS, type TalentId } from "./content/talents";
export { BOONS, type BoonId } from "./content/boons";
import type { SpeciesId } from "./content";
import { definition, species, SPECIES } from "./content";
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
export const KEYWORDS = PROGRESSION_KEYWORDS;
export type Keyword = ProgressionKeyword;
export type KeywordXP = Partial<Record<Keyword, number>>;
export function cardKeywords(card: Pick<Card, "definitionId">): Keyword[] {
  return definitionKeywords(definition(card.definitionId));
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
  return Math.max(
    0,
    Math.min(
      talentPoints(state.keywordXP[keyword] ?? 0),
      TALENTS.filter((t) => t.keyword === keyword).length,
    ) - state.talents.filter((id) => id.startsWith(`${keyword}.`)).length,
  );
}
export function canBuyTalent(state: Pick<GameState, "talents" | "keywordXP">, id: string) {
  const talent = TALENTS.find((t) => t.id === id);
  return (
    !!talent &&
    !state.talents.includes(id) &&
    availablePoints(state, talent.keyword) > 0 &&
    TALENTS.filter((t) => t.keyword === talent.keyword && t.row < talent.row).every((t) =>
      state.talents.includes(t.id),
    )
  );
}
