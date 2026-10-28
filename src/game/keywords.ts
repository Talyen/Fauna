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
    physical: entry("Physical", "damage", "active", "Damage reduced by Armor after Block"),
    criticalHit: entry(
      "Critical Hit",
      "effect",
      "active",
      "An attack that deals double damage; Attacks on either side have a base 5% critical chance",
      ["Critical Hits", "Critically Hits", "Critical"],
    ),
    poison: entry(
      "Poison",
      "damage",
      "active",
      "Poison hits add stacks equal to their damage before Block; At the affected creature's turn start, deal damage equal to the stacks, then remove 20% of them, rounded to the nearest whole number with a minimum of 1",
    ),
    water: entry(
      "Water",
      "damage",
      "active",
      "Direct damage absorbed by Block; Ignores Armor and applies no status effect",
    ),
    nature: entry(
      "Nature",
      "damage",
      "active",
      "Direct damage absorbed by Block; Ignores Armor and applies no status effect",
    ),
    light: entry(
      "Light",
      "damage",
      "active",
      "Direct damage absorbed by Block; Ignores Armor and applies no status effect",
      ["Holy"],
    ),
    health: entry(
      "Health",
      "resource",
      "active",
      "A creature's remaining life; At 0 Health it is knocked out; Healing restores Health up to its maximum but cannot revive a knocked-out creature during battle",
      ["Heal", "Heals", "Healed", "Healing"],
    ),
    mana: entry(
      "Mana",
      "resource",
      "active",
      "Your team's shared resource for playing cards; Normally restored to 4 each turn; A Mana Crystal is 1 point of maximum Mana",
      ["Mana Crystal", "Mana Crystals", "Maximum Mana"],
    ),
    block: entry(
      "Block",
      "status",
      "active",
      "Absorbs damage before Health, including damage over time; Does not normally prevent hit effects, status buildup or Leech; Remaining Block normally halves at the creature's next turn, rounded to the nearest whole number",
      ["Blocks", "Blocked", "Blocking"],
    ),
    thorns: entry(
      "Thorns",
      "effect",
      "active",
      "When hit or when an attack is Negated, deal Nature damage equal to your Thorns, then lose 1 stack; Triggers even through Block or Armor; Retaliation cannot trigger more retaliation",
      ["Thorn"],
    ),
    dodge: entry(
      "Dodge",
      "status",
      "active",
      "Avoid an incoming attack before Block or Armor; Base chance is 5%, capped at 75% with bonuses; Stunned or Frozen creatures normally cannot Dodge; Damage over time cannot be Dodged",
      ["Dodges", "Dodged", "Dodging"],
    ),
    blind: entry(
      "Blind",
      "status",
      "active",
      "Your next attack has a 50% chance to miss all its targets; Expires after that attack, hit or miss; A miss counts as a Dodge by each target; Does not stack",
      ["Blinds", "Blinded", "Blinding"],
    ),
    armor: entry(
      "Armor",
      "status",
      "active",
      "Reduces Physical and Stun damage remaining after Block by its stack count; Loses 1 stack whenever it reduces damage",
      ["Armored"],
    ),
    burn: entry(
      "Burn",
      "damage",
      "active",
      "Burn hits add stacks equal to their damage before Block; At the affected creature's turn start, deal damage equal to the stacks, then halve them; The last stack clears after dealing damage",
      ["Burns", "Burning", "Burned"],
    ),
    freeze: entry(
      "Freeze",
      "status",
      "active",
      "Freeze hits add buildup equal to their damage before Block; When buildup reaches half maximum Health, the creature becomes Frozen and skips one turn; Recovery grants 3 turns of immunity to both Stun and Freeze",
      ["Freezes", "Frozen", "Freezing"],
    ),
    bleed: entry(
      "Bleed",
      "damage",
      "active",
      "Bleed hits add stacks equal to their damage before Block; At the affected creature's next turn start, deal damage equal to the stacks, then clear them",
      ["Bleeds", "Bleeding"],
    ),
    stun: entry(
      "Stun",
      "status",
      "active",
      "Stun hits add buildup equal to their damage before Block, reduced by Armor; When buildup reaches half maximum Health, the creature becomes Stunned and skips one turn; Recovery grants 3 turns of immunity to both Stun and Freeze",
      ["Stuns", "Stunned", "Stunning"],
    ),
    leech: entry(
      "Leech",
      "effect",
      "active",
      "Restore Health equal to half the damage dealt, rounded to the nearest whole number; Includes damage absorbed by Block, but not damage prevented by Armor or excess damage beyond a knockout; Bleed restores this Health when it deals damage over time",
      ["Leeches", "Leeched", "Leeching"],
    ),
    cleanse: entry(
      "Cleanse",
      "effect",
      "active",
      "Remove the stated number of harmful effect types from an ally, clearing all stacks of each removed type",
      ["Cleanses", "Cleansed", "Cleansing"],
    ),
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
      "Return the next incoming ability attack to its attacker; Prevents that attack’s damage and harmful effects on you; Reflected attacks cannot reflect again; Lasts until used or Purged; Does not stack",
      ["Reflect the next attack"],
    ),
    negate: entry(
      "Negate",
      "effect",
      "active",
      "Cancel the next incoming ability attack and its harmful effects on you before Dodge; Thorns still retaliate; Lasts until used or Purged; Does not stack",
      ["Negated", "Negates"],
    ),
    nullify: entry(
      "Nullify",
      "effect",
      "active",
      "Prevent the next Burn, Poison, Bleed, Stun, Freeze or Blind application; Direct damage and existing statuses are unchanged; Lasts until used or Purged; Does not stack",
      ["Nullified"],
    ),
    reflect: entry(
      "Reflect",
      "status",
      "active",
      "Redirect the specified harmful status to a random living enemy; Direct damage still lands on you; Attack Reflection instead returns the whole attack to its attacker; Reflected effects cannot reflect again; Charges do not stack",
      ["Reflection", "Reflected", "Reflecting"],
    ),
    purge: entry(
      "Purge",
      "effect",
      "active",
      "Remove the stated number of beneficial effect types from an enemy, starting with Block and clearing all stacks of each removed type",
      ["Purges", "Purged", "Purging"],
    ),
    food: entry(
      "Food",
      "card",
      "active",
      "Cards shared by your team; Apple restores 6 Health, Mana Berries grant 2 Mana and Trail Bread grants 6 Block; Each costs 1 Mana and is Consumed when played",
      ["Foods"],
    ),
    consume: entry(
      "Consume",
      "card",
      "active",
      "Remove the card for the rest of the battle after it is played; Unplayed cards discard normally; Your starting deck returns each battle",
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
const progressionKeywords = new Set<string>(PROGRESSION_KEYWORDS);
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
    if (progressionKeywords.has(keyword) && !keywords.includes(keyword)) keywords.push(keyword);
  };
  if (definition.effect === "attack") add(definition.damageType!);
  else for (const keyword of abilityRule(definition.effect).keywords) add(keyword);
  if (definition.effect === "attack" && definition.alternateDamageType) add(definition.alternateDamageType);
  if (definition.effects)
    for (const effect of definition.effects) {
      const supplemental = isSupplementalKind(effect.kind);
      if (!supplemental) add(effect.kind);
      const keyword = supplemental ? supplementalRule(effect.kind).keyword : null;
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
  if (!text) return [];
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
