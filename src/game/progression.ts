import { definition } from "./content";
import { PROGRESSION_KEYWORDS, definitionKeywords, type ProgressionKeyword } from "./keywords";
export { progressionLabel as keywordLabel } from "./keywords";
import type { Card, GameState } from "./types";
export const KEYWORDS = PROGRESSION_KEYWORDS;
export type Keyword = ProgressionKeyword;
export type KeywordXP = Partial<Record<Keyword, number>>;
export function cardKeywords(card: Pick<Card, "definitionId">): Keyword[] {
  return definitionKeywords(definition(card.definitionId));
}
export const TALENTS = [
  {
    id: "physical.shield-slam",
    keyword: "physical",
    effect: "shield-slam",
    name: "Shield Slam",
    text: "Add half your Block to Physical damage.",
    row: 0,
  },
  {
    id: "physical.armored-fists",
    keyword: "physical",
    effect: "armored-fists",
    name: "Armored Fists",
    text: "Add half your Armor to Physical damage.",
    row: 0,
  },
  {
    id: "burn.flashpoint",
    keyword: "burn",
    effect: "flashpoint",
    name: "Flashpoint",
    text: "Your first Burn each battle is free.",
    row: 0,
  },
  {
    id: "burn.melting-point",
    keyword: "burn",
    effect: "melting-point",
    name: "Melting Point",
    text: "Burn damage removes an equal amount of Armor.",
    row: 0,
  },
  {
    id: "freeze.bitter-cold",
    keyword: "freeze",
    effect: "bitter-cold",
    name: "Bitter Cold",
    text: "Reduce enemy Freeze thresholds by 10%.",
    row: 0,
  },
  {
    id: "freeze.glacial-barrier",
    keyword: "freeze",
    effect: "glacial-barrier",
    name: "Glacial Barrier",
    text: "Gain 3 Block when you Freeze an enemy.",
    row: 0,
  },
  {
    id: "stun.guarded-counter",
    keyword: "stun",
    effect: "guarded-counter",
    name: "Guarded Counter",
    text: "Stunning an enemy grants 4 Block if you have none.",
    row: 0,
  },
  {
    id: "stun.shatter-guard",
    keyword: "stun",
    effect: "shatter-guard",
    name: "Shatter Guard",
    text: "Stunning an enemy removes all its Armor.",
    row: 0,
  },
  {
    id: "poison.necrosis",
    keyword: "poison",
    effect: "necrosis",
    name: "Necrosis",
    text: "Poisoned enemies receive half as much healing.",
    row: 0,
  },
  {
    id: "poison.torpor",
    keyword: "poison",
    effect: "torpor",
    name: "Torpor",
    text: "Poisoned enemies cannot Dodge.",
    row: 0,
  },
  {
    id: "nature.bramblegrowth",
    keyword: "nature",
    effect: "bramblegrowth",
    name: "Bramblegrowth",
    text: "Nature damage has a 10% chance to grant Thorns.",
    row: 0,
  },
  {
    id: "nature.ecosystem",
    keyword: "nature",
    effect: "ecosystem",
    name: "Ecosystem",
    text: "Draw a Nature card at battle start.",
    row: 0,
  },
  {
    id: "light.faith-barrier",
    keyword: "light",
    effect: "faith-barrier",
    name: "Faith Barrier",
    text: "Light damage has a 10% chance to grant Block.",
    row: 0,
  },
  {
    id: "light.blessed-leech",
    keyword: "light",
    effect: "blessed-leech",
    name: "Blessed Leech",
    text: "Light damage Leeches while below half Health.",
    row: 0,
  },
  {
    id: "bleed.first-blood",
    keyword: "bleed",
    effect: "first-blood",
    name: "First Blood",
    text: "Deal 25% more Bleed damage against enemies that aren’t already Bleeding.",
    row: 0,
  },
  {
    id: "bleed.mortal-wound",
    keyword: "bleed",
    effect: "mortal-wound",
    name: "Mortal Wound",
    text: "Bleeding enemies receive half as much healing.",
    row: 0,
  },
  {
    id: "block.second-wind",
    keyword: "block",
    effect: "second-wind",
    name: "Second Wind",
    text: "Restore 2 Health when your Block is depleted.",
    row: 0,
  },
  {
    id: "block.grounding",
    keyword: "block",
    effect: "grounding",
    name: "Grounding",
    text: "Block prevents Stun buildup.",
    row: 0,
  },
  {
    id: "heal.mending",
    keyword: "heal",
    effect: "mending",
    name: "Mending",
    text: "Receive 10% more healing during combat.",
    row: 0,
  },
  {
    id: "heal.renewal",
    keyword: "heal",
    effect: "renewal",
    name: "Renewal",
    text: "Cleansing a harmful status restores 2 Health.",
    row: 0,
  },
  {
    id: "armor.bulwark",
    keyword: "armor",
    effect: "bulwark",
    name: "Bulwark",
    text: "Start each battle with 2 Armor.",
    row: 0,
  },
  {
    id: "armor.reactive-guard",
    keyword: "armor",
    effect: "reactive-guard",
    name: "Reactive Guard",
    text: "Gain 3 Block when your Armor breaks.",
    row: 0,
  },
  {
    id: "dodge.lightfoot",
    keyword: "dodge",
    effect: "lightfoot",
    name: "Lightfoot",
    text: "Gain 5% Dodge chance.",
    row: 0,
  },
  {
    id: "dodge.catch-breath",
    keyword: "dodge",
    effect: "catch-breath",
    name: "Catch Breath",
    text: "Restore 1 Health when you Dodge.",
    row: 0,
  },
  {
    id: "leech.deep-siphon",
    keyword: "leech",
    effect: "deep-siphon",
    name: "Deep Siphon",
    text: "Leech restores 1 additional Health.",
    row: 0,
  },
  {
    id: "leech.desperate-siphon",
    keyword: "leech",
    effect: "desperate-siphon",
    name: "Desperate Siphon",
    text: "Double Leech healing while below half Health.",
    row: 0,
  },
  {
    id: "mana.wellspring",
    keyword: "mana",
    effect: "wellspring",
    name: "Wellspring",
    text: "End your turn with unspent Mana to gain 1 extra Mana next turn.",
    row: 0,
  },
  {
    id: "mana.dark-recovery",
    keyword: "mana",
    effect: "dark-recovery",
    name: "Dark Recovery",
    text: "End your turn with no Mana to gain 1 extra Mana next turn.",
    row: 0,
  },
] as const;
export type TalentId = (typeof TALENTS)[number]["id"];
export const TALENT_EFFECTS = TALENTS.map((talent) => talent.effect);
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
export const BOONS = [
  { id: "tattered-pages", name: "Tattered Pages", text: "Draw 1 additional card at battle start." },
  { id: "bone-charm", name: "Bone Charm", text: "Restore 3 Health when you defeat an enemy." },
  { id: "ironwood-buckler", name: "Ironwood Buckler", text: "Gain 1 Thorns whenever you gain Block." },
  { id: "icy-heart", name: "Icy Heart", text: "Freezing an enemy deals 6 Physical damage." },
] as const;
export type BoonId = (typeof BOONS)[number]["id"];
