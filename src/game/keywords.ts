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
      "The shared resource spent to play action cards; Your team starts each turn with 4 Mana; Mana is shared; each turn draws 4 cards, with up to 7 in hand",
    ),
    block: entry(
      "Block",
      "status",
      "active",
      "Absorbs incoming damage before health; Each point absorbs one damage and is spent; Remaining Block normally halves at the start of your next turn, rounded normally",
    ),
    thorns: entry(
      "Thorns",
      "effect",
      "active",
      "Thorns retaliate with Nature damage when an opposing attack removes Health, then lose 1 stack",
      ["Thorn"],
    ),
    dodge: entry(
      "Dodge",
      "status",
      "active",
      "Both sides have a 5% chance to avoid each attack packet before defenses; Controlled targets cannot Dodge; Total Dodge is capped at 75%",
      ["Dodges", "Dodged", "Dodging"],
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
      "Damage builds toward Frozen: skip one turn at half an ally's maximum Health or an enemy's pre-hit Health; Recovery grants 3 turns of shared Stun/Freeze immunity",
      ["Freezes", "Frozen"],
    ),
    bleed: entry("Bleed", "damage", "active", "Repeat damage next turn, then clear", ["Bleeds", "Bleeding"]),
    stun: entry(
      "Stun",
      "status",
      "active",
      "Damage builds toward Stunned: skip one turn at half an ally's maximum Health or an enemy's pre-hit Health; Recovery grants 3 turns of shared Stun/Freeze immunity",
      ["Stunned"],
    ),
    leech: entry(
      "Leech",
      "effect",
      "active",
      "Restore half the Health damage dealt, rounded normally; Bleed pays Leech with its later tick",
      ["Leeches", "Leeching"],
    ),
    cleanse: entry("Cleanse", "effect", "active", "Remove harmful effects from an ally", [
      "Cleanses",
      "Cleansed",
      "Cleansing",
    ]),
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
export const EFFECT_KEYWORDS = freeze(
  {
    attack: [],
    guard: ["block"],
    heal: ["health"],
    teamGuard: ["block"],
  } as const,
  true,
);
export function definitionKeywords(definition: {
  effect: keyof typeof EFFECT_KEYWORDS;
  damageType?: DamageType;
  leech?: boolean;
  effects?: readonly { kind: string; status?: string; damageType?: DamageType; leech?: boolean }[];
}): ProgressionKeyword[] {
  const raw: string[] =
    definition.effect === "attack" ? [definition.damageType!] : [...EFFECT_KEYWORDS[definition.effect]];
  for (const effect of definition.effects ?? []) {
    raw.push(
      effect.kind === "damage" ? effect.damageType! : effect.kind === "status" ? effect.status! : effect.kind,
    );
    if (effect.leech) raw.push("leech");
  }
  if (definition.leech) raw.push("leech");
  return [
    ...new Set(
      raw
        .map((id) => progressionCategory[id as KeywordId] ?? id)
        .filter((id): id is ProgressionKeyword => PROGRESSION_KEYWORDS.includes(id as ProgressionKeyword)),
    ),
  ];
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
