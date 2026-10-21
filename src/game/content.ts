import { DAMAGE_TYPES, keywordLabel, type DamageType, EFFECT_KEYWORDS } from "./keywords";
export { type DamageType } from "./keywords";
export type SpeciesId = "mossback" | "emberfox" | "stormfin" | "silkmoth" | "briartooth" | "moonhart";
type Effect = keyof typeof EFFECT_KEYWORDS;
export interface Species {
  id: SpeciesId;
  name: string;
  title: string;
  health: number;
  color: string;
  trait: string;
  description: string;
}
export const DAMAGE_LABELS = Object.fromEntries(DAMAGE_TYPES.map((id) => [id, keywordLabel(id)])) as Record<
  DamageType,
  string
>;
type CardEffect =
  | { kind: "damage"; damageType: DamageType; amount: number; leech?: boolean }
  | { kind: "status"; status: "armor" | "thorns" | "dodge"; amount: number }
  | { kind: "draw" | "mana" | "cleanse" | "purge"; amount: number };
interface CardBase {
  id: string;
  species: SpeciesId;
  name: string;
  value: number;
  cost: number;
  leech?: boolean;
  effects?: readonly CardEffect[];
}
export type CardDefinition = CardBase &
  ({ effect: "attack"; damageType: DamageType } | { effect: Exclude<Effect, "attack"> });
export const SPECIES: readonly Species[] = [
  {
    id: "mossback",
    name: "Mossback",
    title: "The gentle guardian",
    health: 32,
    color: "#9ead70",
    trait: "Rooted",
    description: "Guard cards grant 2 extra block.",
  },
  {
    id: "emberfox",
    name: "Emberfox",
    title: "A spark in the undergrowth",
    health: 24,
    color: "#ed9c65",
    trait: "Kindling",
    description: "First attack each turn deals 2 extra damage.",
  },
  {
    id: "stormfin",
    name: "Stormfin",
    title: "The gathering storm",
    health: 26,
    color: "#8cbecb",
    trait: "Charged",
    description: "Lightning attacks deal 1 extra damage.",
  },
  {
    id: "silkmoth",
    name: "Silkmoth",
    title: "A little light in the dark",
    health: 23,
    color: "#d1b5d3",
    trait: "Tender",
    description: "Healing cards restore 2 extra health.",
  },
  {
    id: "briartooth",
    name: "Briartooth",
    title: "Wild at heart",
    health: 30,
    color: "#c7b76b",
    trait: "Thorns",
    description:
      "Start each battle with 2 Thorns. When an attack removes Health, retaliate with current Thorns, then lose 1 stack.",
  },
  {
    id: "moonhart",
    name: "Moonhart",
    title: "Keeper of the quiet paths",
    health: 28,
    color: "#b7c6e0",
    trait: "Moonlit",
    description: "Start each battle with 4 block.",
  },
];
const card = (
  species: SpeciesId,
  name: string,
  effect: Exclude<Effect, "attack">,
  value: number,
  cost = 1,
): CardDefinition => ({
  id: `${species}-${effect}`,
  species,
  name,
  effect,
  value,
  cost,
});
const attack = (species: SpeciesId, name: string, value: number, damageType: DamageType): CardDefinition => ({
  id: `${species}-attack`,
  species,
  name,
  effect: "attack",
  value,
  cost: 1,
  damageType,
});
export const CARDS: readonly CardDefinition[] = [
  {
    ...attack("mossback", "Bramble Bash", 6, "nature"),
    effects: [{ kind: "damage", damageType: "poison", amount: 2 }],
  },
  { ...card("mossback", "Shelter", "guard", 7), effects: [{ kind: "status", status: "armor", amount: 1 }] },
  card("mossback", "Forest Mantle", "teamGuard", 3),
  {
    ...attack("emberfox", "Cinder Strike", 8, "fire"),
    effects: [{ kind: "damage", damageType: "burn", amount: 2 }],
  },
  card("emberfox", "Warm Embers", "heal", 5),
  card("emberfox", "Ember Ward", "guard", 6),
  {
    ...attack("stormfin", "Arc Bite", 7, "lightning"),
    effects: [{ kind: "damage", damageType: "stun", amount: 3 }],
  },
  { ...card("stormfin", "Storm Shelter", "teamGuard", 3), effects: [{ kind: "draw", amount: 1 }] },
  {
    ...card("stormfin", "Static Veil", "guard", 6),
    effects: [{ kind: "status", status: "dodge", amount: 10 }],
  },
  attack("silkmoth", "Glimmer", 5, "light"),
  card("silkmoth", "Mending Light", "heal", 8),
  { ...card("silkmoth", "Silken Ward", "guard", 7), effects: [{ kind: "cleanse", amount: 1 }] },
  {
    ...attack("briartooth", "Thornlash", 8, "physical"),
    leech: true,
    effects: [{ kind: "damage", damageType: "bleed", amount: 2, leech: true }],
  },
  {
    ...card("briartooth", "Briar Coat", "guard", 7),
    effects: [{ kind: "status", status: "thorns", amount: 1 }],
  },
  card("briartooth", "Briar Shelter", "teamGuard", 3),
  {
    ...attack("moonhart", "Moonbeam", 8, "light"),
    effects: [
      { kind: "damage", damageType: "freeze", amount: 4 },
      { kind: "purge", amount: 1 },
    ],
  },
  { ...card("moonhart", "Silver Light", "heal", 7), effects: [{ kind: "mana", amount: 1 }] },
  card("moonhart", "Night Shelter", "teamGuard", 4),
];
export function enemyCard(card: CardDefinition): CardDefinition {
  return {
    ...card,
    effects: card.effects?.filter((effect) => ["damage", "status", "cleanse", "purge"].includes(effect.kind)),
  };
}
export const FIRST_RUN_STARTERS: readonly SpeciesId[] = [
  "mossback",
  "emberfox",
  "stormfin",
  "silkmoth",
  "briartooth",
];
export const INITIAL_SPECIES = SPECIES.slice(0, 5).map((s) => s.id);
export function species(id: SpeciesId): Species {
  const result = SPECIES.find((s) => s.id === id);
  if (!result) throw new Error(`Unknown species: ${id}`);
  return result;
}
export function definition(id: string): CardDefinition {
  const result = CARDS.find((c) => c.id === id);
  if (!result) throw new Error(`Unknown card: ${id}`);
  return result;
}
export function cardText(card: CardDefinition, level = 0, value = card.value + level * 2): string {
  let text: string;
  switch (card.effect) {
    case "attack":
      text = `Deal ${value} ${DAMAGE_LABELS[card.damageType]} damage.`;
      break;
    case "guard":
      text = `Give an ally ${value} Block.`;
      break;
    case "heal":
      text = `Restore ${value} Health to a living ally.`;
      break;
    case "teamGuard":
      text = `Give every living ally ${value} Block.`;
      break;
  }
  for (const effect of card.effects ?? []) {
    text +=
      " " +
      (effect.kind === "damage"
        ? `Deal ${effect.amount} ${DAMAGE_LABELS[effect.damageType]} damage${effect.leech ? " with Leech" : ""}.`
        : effect.kind === "status"
          ? `Acting creature gains ${effect.amount} ${keywordLabel(effect.status)}.`
          : effect.kind === "draw"
            ? `Draw ${effect.amount}.`
            : effect.kind === "mana"
              ? `Restore ${effect.amount} Mana.`
              : `${effect.kind === "cleanse" ? "Cleanse acting creature" : "Purge target"}: remove ${effect.amount} effect${effect.amount === 1 ? "" : "s"}.`);
  }
  if (card.leech) text += " Leech.";
  return text;
}
/** Stable legacy route; new expeditions use the saved packs in encounters.ts. */
export const ENCOUNTERS = [
  {
    name: "The overgrown trail",
    enemies: [
      { damageType: "nature", name: "Bramble Imp", species: "briartooth" as const, health: 18, damage: 4 },
      { damageType: "fire", name: "Cinder Wisp", species: "emberfox" as const, health: 16, damage: 4 },
      { damageType: "light", name: "Dusk Moth", species: "silkmoth" as const, health: 16, damage: 4 },
    ],
  },
  {
    name: "Beyond the fernwood",
    enemies: [
      {
        damageType: "physical",
        name: "Thicket Stalker",
        species: "stormfin" as const,
        health: 24,
        damage: 5,
      },
      { damageType: "light", name: "Dusk Moth", species: "silkmoth" as const, health: 22, damage: 5 },
      { damageType: "nature", name: "Moss Imp", species: "mossback" as const, health: 18, damage: 4 },
    ],
  },
  {
    name: "Heart of the wilds",
    enemies: [
      { damageType: "light", name: "The Hollow Crown", species: "moonhart" as const, health: 68, damage: 10 },
    ],
  },
] as const;
