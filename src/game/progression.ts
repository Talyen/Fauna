import { DAMAGE_TYPES, DAMAGE_LABELS, definition } from "./content";
import type { Card, GameState } from "./types";
export const KEYWORDS = [...DAMAGE_TYPES, "block", "heal", "mark"] as const;
export type Keyword = (typeof KEYWORDS)[number];
export type KeywordXP = Partial<Record<Keyword, number>>;
export const keywordLabel = (id: Keyword) =>
  id in DAMAGE_LABELS
    ? DAMAGE_LABELS[id as keyof typeof DAMAGE_LABELS]
    : ({ block: "Block", heal: "Healing", mark: "Mark" } as const)[id as "block" | "heal" | "mark"];
export function cardKeywords(card: Pick<Card, "definitionId">): Keyword[] {
  const def = definition(card.definitionId);
  return [
    def.effect === "attack"
      ? def.damageType
      : def.effect === "guard" || def.effect === "teamGuard"
        ? "block"
        : def.effect,
  ];
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
export function talentPoints(xp: number) {
  return Math.floor((Math.sqrt(1 + 0.4 * xp) - 1) / 2);
}
export function keywordProgress(xp: number) {
  const points = talentPoints(xp),
    start = 10 * points * (points + 1),
    end = 10 * (points + 1) * (points + 2);
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
  { id: "thorn-ring", name: "Thorn Ring", text: "Your creatures' Mark cards apply 1 additional Mark." },
] as const;
export type RelicId = (typeof RELICS)[number]["id"];
