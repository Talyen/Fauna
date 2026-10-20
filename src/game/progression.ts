import { definition } from "./content";
import { PROGRESSION_KEYWORDS, definitionKeywords, type ProgressionKeyword } from "./keywords";
export { keywordLabel } from "./keywords";
import type { Card, GameState } from "./types";
export const KEYWORDS = PROGRESSION_KEYWORDS;
export type Keyword = ProgressionKeyword;
export type KeywordXP = Partial<Record<Keyword, number>>;
export function cardKeywords(card: Pick<Card, "definitionId">): Keyword[] {
  return definitionKeywords(definition(card.definitionId));
}
export const TALENT_EFFECTS = ["potency", "mastery", "shelter", "focus", "renewal", "opening"] as const;
export type TalentEffect = (typeof TALENT_EFFECTS)[number];
const effects: { id: TalentEffect; name: string; text: string }[] = [
  { id: "potency", name: "Potency", text: "Matching cards gain +1 to their effect." },
  { id: "mastery", name: "Mastery", text: "Matching cards gain another +1 to their effect." },
  {
    id: "shelter",
    name: "Shelter",
    text: "After playing a matching card, its acting creature gains 2 Block.",
  },
  {
    id: "focus",
    name: "Guarded Focus",
    text: "Matching cards gain +2 to their effect while their acting creature has Block.",
  },
  {
    id: "renewal",
    name: "Renewal",
    text: "After playing a matching card, restore 1 Health to its acting creature.",
  },
  {
    id: "opening",
    name: "Readiness",
    text: "At battle start, each active creature contributing a matching card gains 2 Block.",
  },
];
export const TALENTS = KEYWORDS.flatMap((keyword) =>
  effects.map((effect, index) => ({
    ...effect,
    keyword,
    effect: effect.id,
    id: `${keyword}.${effect.id}`,
    row: Math.floor(index / 2),
  })),
);
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
export function hasTalent(state: Pick<GameState, "talents">, keyword: Keyword, effect: TalentEffect) {
  return state.talents.includes(`${keyword}.${effect}`);
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
export const RELICS = [
  { id: "emberstone", name: "Emberstone", text: "Your creatures deal 1 additional Fire damage." },
  { id: "wind-feather", name: "Wind Feather", text: "Draw one additional card at the start of each battle." },
  { id: "river-shell", name: "River Shell", text: "Your creatures begin each battle with 3 Block." },
  {
    id: "living-seed",
    name: "Living Seed",
    text: "Your creatures' healing cards restore 2 additional Health.",
  },
] as const;
export type RelicId = (typeof RELICS)[number]["id"];
