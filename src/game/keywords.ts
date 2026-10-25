import type { AbilityKind } from "./rules/ability-types";
import { abilityRule } from "./rules/abilities";
import { isSupplementalKind, supplementalRule } from "./rules/supplemental";
import { RESURRECTION_HEALTH_PERCENT } from "./resurrection-rules";
import { freeze } from "immer";

export interface KeywordDefinition {
  readonly label: string;
  readonly category: "damage" | "resource" | "effect" | "status" | "card";
  readonly availability: "active" | "planned";
  readonly description: string;
  readonly aliases: readonly string[];
}
const entry = (
  label: string,
  category: KeywordDefinition["category"],
  availability: KeywordDefinition["availability"],
  description: string,
  aliases: readonly string[] = [],
): KeywordDefinition => ({ label, category, availability, description, aliases });

/** Adapted from Alchemy's keyword catalog. Planned entries never imply implemented rules. */
export const KEYWORD_DEFINITIONS = freeze(
  {
    physical: entry(
      "Physical",
      "damage",
      "active",
      "Physical damage is reduced by Armor after Block; Attacks have a 5% critical chance for double damage",
    ),
    poison: entry(
      "Poison",
      "damage",
      "active",
      "Poison hits add damage dealt as Poison; At turn start it deals its stacks as damage, then loses 20% (at least 1)",
    ),
    water: entry(
      "Water",
      "damage",
      "active",
      "Water damage; Block absorbs it; Armor does not reduce it; No status effect is applied",
    ),
    nature: entry("Nature", "damage", "active", "Nature damage; No resistance or status effect is implied"),
    light: entry("Light", "damage", "active", "Light damage; No resistance or status effect is implied", [
      "Holy",
    ]),
    health: entry(
      "Health",
      "resource",
      "active",
      "Remaining life; At zero Health a creature is knocked out; Restore Health up to its maximum; restoration cannot revive it during battle",
    ),
    mana: entry(
      "Mana",
      "resource",
      "active",
      "The shared resource spent to play action cards; Your team starts each turn with 4 Mana; Mana is shared; each turn draws 4 cards, with up to 6 in hand",
    ),
    block: entry(
      "Block",
      "status",
      "active",
      "Absorbs incoming damage before Health; Does not prevent hit effects, buildup or Leech unless specified; Remaining Block normally halves at the start of your next turn, rounded normally",
    ),
    waterThorns: entry(
      "Water Thorns",
      "effect",
      "active",
      "Water Thorns retaliate with Water damage when hit, even through Block, then lose 1 stack; Separate from Nature Thorns",
    ),
    thorns: entry(
      "Thorns",
      "effect",
      "active",
      "Thorns retaliate with Nature damage when hit, even through Block, then lose 1 stack",
      ["Thorn"],
    ),
    dodge: entry(
      "Dodge",
      "status",
      "active",
      "Both sides have a 5% chance to avoid each attack packet before defenses; Controlled targets cannot Dodge; Total Dodge is capped at 75%",
      ["Dodges", "Dodged", "Dodging"],
    ),
    blind: entry(
      "Blind",
      "status",
      "active",
      "50% chance to miss your next attack; Expires after that attack, whether it hits or misses; A miss counts as a Dodge by every recipient; Does not stack",
      ["Blinded", "Blinding"],
    ),
    armor: entry(
      "Armor",
      "status",
      "active",
      "Reduce incoming Physical and Stun damage; lose a stack when damaged",
    ),
    burn: entry("Burn", "damage", "active", "Deal damage each turn, then halve the stacks", [
      "Burns",
      "Burning",
      "Burned",
    ]),
    freeze: entry(
      "Freeze",
      "status",
      "active",
      "Damage builds toward Frozen: skip one turn at half maximum Health; Recovery grants 3 turns of shared Stun/Freeze immunity",
      ["Freezes", "Frozen"],
    ),
    bleed: entry("Bleed", "damage", "active", "Repeat damage next turn, then clear", ["Bleeds", "Bleeding"]),
    stun: entry(
      "Stun",
      "status",
      "active",
      "Damage builds toward Stunned: skip one turn at half maximum Health; Recovery grants 3 turns of shared Stun/Freeze immunity",
      ["Stunned"],
    ),
    leech: entry(
      "Leech",
      "effect",
      "active",
      "Restore half the damage dealt, including damage absorbed by Block, rounded normally; Overkill does not count; Bleed pays Leech with its later tick",
      ["Leeches", "Leeching"],
    ),
    cleanse: entry("Cleanse", "effect", "active", "Remove harmful effects from an ally", [
      "Cleanses",
      "Cleansed",
      "Cleansing",
    ]),
    resurrect: entry(
      "Resurrect",
      "effect",
      "active",
      `Return a knocked-out ally with ${RESURRECTION_HEALTH_PERCENT}% of their maximum Health, rounded normally with a minimum of 1; Does not renew Death’s Door`,
      ["Resurrects", "Resurrected", "Resurrection"],
    ),
    attackReflection: entry(
      "Attack Reflection",
      "effect",
      "active",
      "Return the next attack against you to its attacker; Prevents that attack’s damage and harmful effects on you; Reflected attacks cannot reflect again; Lasts until consumed or Purged; Does not stack",
      ["Reflect the next attack"],
    ),
    negate: entry(
      "Negate",
      "effect",
      "active",
      "Negate the next attack against you before Dodge, preventing its damage and harmful effects; Thorns still retaliate; Lasts until consumed or Purged; Does not stack",
      ["Negated", "Negates"],
    ),
    nullify: entry(
      "Nullify",
      "effect",
      "active",
      "Prevent the next harmful status effect; Direct damage still lands; Lasts until consumed or Purged; Does not stack",
      ["Nullified"],
    ),
    reflect: entry(
      "Reflect",
      "status",
      "active",
      "Redirect the next harmful status effect to a random living enemy at its original strength; Direct damage still lands; Reflected effects cannot be reflected again; Does not stack",
      ["Reflection", "Reflected", "Reflecting"],
    ),
    purge: entry("Purge", "effect", "active", "Remove beneficial effects from an enemy", [
      "Purges",
      "Purged",
      "Purging",
    ]),
    food: entry(
      "Food",
      "card",
      "active",
      "Shared consumables; Apple restores 6 Health; Mana Berries grant 2 Mana; Trail Bread grants 6 Block; Each costs 1 Mana and has Consume",
      ["Foods"],
    ),
    consume: entry(
      "Consume",
      "card",
      "active",
      "Remove this card from the battle after it is played; Unplayed cards discard normally",
    ),
  },
  true,
);
export type KeywordId = keyof typeof KEYWORD_DEFINITIONS;
export const KEYWORD_IDS = freeze(Object.keys(KEYWORD_DEFINITIONS) as KeywordId[]);
export function isKeywordId(value: string): value is KeywordId {
  return Object.hasOwn(KEYWORD_DEFINITIONS, value);
}
export const keywordLabel = (id: KeywordId): string => KEYWORD_DEFINITIONS[id].label;

export const DAMAGE_TYPES = freeze([
  "physical",
  "poison",
  "nature",
  "water",
  "light",
  "burn",
  "freeze",
  "bleed",
  "stun",
] as const);
export type DamageType = (typeof DAMAGE_TYPES)[number];
// Vocabulary alone does not grant XP or talents.
export const PROGRESSION_KEYWORDS = freeze([
  "physical",
  "burn",
  "freeze",
  "stun",
  "poison",
  "nature",
  "water",
  "light",
  "bleed",
  "block",
  "health",
  "armor",
  "dodge",
  "leech",
  "mana",
] as const);
export type ProgressionKeyword = (typeof PROGRESSION_KEYWORDS)[number];
const progressionCategory: Partial<Record<KeywordId, ProgressionKeyword>> = {
  thorns: "nature",
  cleanse: "health",
  purge: "light",
};
export const progressionLabel = (id: ProgressionKeyword) => keywordLabel(id);
export function definitionKeywords(definition: {
  effect: AbilityKind;
  damageType?: DamageType;
  alternateDamageType?: DamageType;
  leech?: boolean;
  effects?: readonly { kind: string; status?: string; damageType?: DamageType; leech?: boolean }[];
}): ProgressionKeyword[] {
  const keywords: ProgressionKeyword[] = [];
  const add = (id: string) => {
    const keyword = (progressionCategory[id as KeywordId] ?? id) as ProgressionKeyword;
    if (PROGRESSION_KEYWORDS.includes(keyword) && !keywords.includes(keyword)) keywords.push(keyword);
  };
  if (definition.effect === "attack") add(definition.damageType!);
  else for (const keyword of abilityRule(definition.effect).keywords) add(keyword);
  if (definition.effect === "attack" && definition.alternateDamageType) add(definition.alternateDamageType);
  for (const effect of definition.effects ?? []) {
    if (!isSupplementalKind(effect.kind)) add(effect.kind);
    const keyword = isSupplementalKind(effect.kind) ? supplementalRule(effect.kind).keyword : null;
    if (keyword)
      add(keyword === "damageType" ? effect.damageType! : keyword === "status" ? effect.status! : keyword);
    if (effect.leech) add("leech");
  }
  if (definition.leech) add("leech");
  return keywords;
}

export interface KeywordTextPart {
  readonly text: string;
  readonly keyword?: KeywordId;
}
const aliases = new Map<string, KeywordId>();
for (const id of KEYWORD_IDS) {
  const definition = KEYWORD_DEFINITIONS[id];
  if (definition.availability !== "active") continue;
  for (const word of [definition.label, ...definition.aliases]) {
    const key = word.toLowerCase();
    if (aliases.has(key)) throw new Error(`Duplicate keyword alias: ${word}`);
    aliases.set(key, id);
  }
}
const pattern = new RegExp(
  `\\b(${[...aliases.keys()]
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "gi",
);
/** Presentation only. Gameplay classification always comes from authored effects, never prose. */
export function keywordText(text: string): KeywordTextPart[] {
  const parts: KeywordTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) });
    parts.push({ text: match[0], keyword: aliases.get(match[0].toLowerCase())! });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
