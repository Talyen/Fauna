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
      "Physical damage. No resistance or status effect is implied.",
    ),
    fire: entry("Fire", "damage", "active", "Fire damage. Does not apply Burn."),
    ice: entry("Ice", "damage", "active", "Ice damage. Does not apply Freeze."),
    lightning: entry("Lightning", "damage", "active", "Lightning damage. Does not apply Stun."),
    poison: entry(
      "Poison",
      "damage",
      "active",
      "Poison damage. Currently immediate damage only; no damage over time.",
    ),
    nature: entry("Nature", "damage", "active", "Nature damage. No resistance or status effect is implied."),
    light: entry("Light", "damage", "active", "Light damage. No resistance or status effect is implied.", [
      "Holy",
    ]),
    health: entry(
      "Health",
      "resource",
      "active",
      "A creature's remaining life. At zero health it is knocked out. Healing cannot exceed maximum health.",
    ),
    mana: entry(
      "Mana",
      "resource",
      "active",
      "The shared resource spent to play action cards. Your team starts each turn with 3 mana.",
    ),
    block: entry(
      "Block",
      "status",
      "active",
      "Absorbs incoming damage before health. Each point absorbs one damage and is spent. Remaining block expires at the start of your next turn.",
    ),
    heal: entry(
      "Healing",
      "effect",
      "active",
      "Restore health to a living creature, up to its maximum health. Cannot revive a knocked-out creature.",
      ["Heal", "Heals", "Healed"],
    ),
    thorns: entry(
      "Thorns",
      "effect",
      "active",
      "Briartooth's passive deals 2 Nature damage back to an attacker when an attack removes health. Fully blocked hits do not trigger it.",
      ["Thorn"],
    ),
    currency: entry(
      "Currency",
      "resource",
      "active",
      "Battle-earned currency is permanent. Spending will be added in a future update.",
      ["Gold"],
    ),
    dodge: entry(
      "Dodge",
      "status",
      "planned",
      "Proposed: avoid an attack before damage and attached status effects resolve.",
      ["Dodges", "Dodged", "Dodging"],
    ),
    armor: entry(
      "Armor",
      "status",
      "planned",
      "Proposed: reduce incoming Physical and Stun damage; lose a stack when damaged.",
    ),
    forge: entry("Forge", "status", "planned", "Proposed: increase Physical and Stun damage."),
    burn: entry("Burn", "status", "planned", "Proposed: deal damage each turn, then halve the stacks.", [
      "Burns",
      "Burning",
      "Burned",
    ]),
    freeze: entry(
      "Freeze",
      "status",
      "planned",
      "Proposed: build toward Frozen, which skips a turn. Fauna's threshold is undecided.",
      ["Freezes", "Frozen"],
    ),
    bleed: entry("Bleed", "status", "planned", "Proposed: repeat damage next turn, then clear.", [
      "Bleeds",
      "Bleeding",
    ]),
    stun: entry(
      "Stun",
      "status",
      "planned",
      "Proposed: build toward Stunned, which skips a turn. Fauna's threshold is undecided.",
      ["Stunned"],
    ),
    leech: entry("Leech", "effect", "planned", "Proposed: restore health based on damage actually dealt.", [
      "Leeches",
      "Leeching",
    ]),
    wish: entry("Wish", "card", "planned", "Proposed: choose an action card from an offer."),
    consume: entry(
      "Consume",
      "card",
      "planned",
      "Proposed: remove the played card for the remainder of the battle.",
      ["Consumed"],
    ),
    archery: entry(
      "Archery",
      "card",
      "planned",
      "Proposed: a ranged attack tag, independent of damage type.",
    ),
    companion: entry(
      "Companion",
      "card",
      "planned",
      "Proposed: summon an additional ally. Its relationship to deployed creatures is undecided.",
      ["Companions"],
    ),
    cleanse: entry("Cleanse", "effect", "planned", "Proposed: remove harmful effects from an ally.", [
      "Cleanses",
      "Cleansed",
      "Cleansing",
    ]),
    purge: entry("Purge", "effect", "planned", "Proposed: remove beneficial effects from an enemy.", [
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
  "fire",
  "ice",
  "lightning",
  "poison",
  "nature",
  "light",
] as const);
export type DamageType = (typeof DAMAGE_TYPES)[number];
// Vocabulary alone does not grant XP or talents.
export const PROGRESSION_KEYWORDS = freeze([...DAMAGE_TYPES, "block", "heal"] as const);
export type ProgressionKeyword = (typeof PROGRESSION_KEYWORDS)[number];
export const EFFECT_KEYWORDS = freeze(
  {
    attack: [],
    guard: ["block"],
    heal: ["heal"],
    teamGuard: ["block"],
  } as const,
  true,
);
export function definitionKeywords(
  definition:
    | { effect: "attack"; damageType: DamageType }
    | { effect: Exclude<keyof typeof EFFECT_KEYWORDS, "attack"> },
): ProgressionKeyword[] {
  return definition.effect === "attack" ? [definition.damageType] : [...EFFECT_KEYWORDS[definition.effect]];
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
