import { DAMAGE_TYPES, keywordLabel, type DamageType, EFFECT_KEYWORDS } from "./keywords";
export { type DamageType } from "./keywords";
export type SpeciesId =
  "mossback" | "emberfox" | "stormfin" | "silkmoth" | "briartooth" | "moonhart" | "emberback" | "pollenmoth";
type Effect = keyof typeof EFFECT_KEYWORDS;
type PassiveEffect =
  | { kind: "cardBonus"; trigger: "firstAttack" | "stunAttack" | "heal" | "guard"; amount: number }
  | { kind: "battleStart"; effect: "block" | "thorns" | "armor"; amount: number }
  | { kind: "armorBreak"; amount: number }
  | { kind: "bounce"; effect: "light" | "heal"; amount: number; chance?: number };
export interface PassiveTier {
  description: string;
  effects: readonly PassiveEffect[];
}
export interface Species {
  id: SpeciesId;
  name: string;
  title: string;
  health: number;
  color: string;
  trait: string;
  passiveTiers: readonly [
    PassiveTier,
    PassiveTier | null,
    PassiveTier | null,
    PassiveTier | null,
    PassiveTier | null,
    PassiveTier | null,
  ];
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
  cost: 1;
  artwork?: string;
  leech?: boolean;
  effects?: readonly CardEffect[];
}
export type CardDefinition = CardBase &
  (
    | { effect: "attack"; damageType: DamageType; target?: "allEnemies" | "randomEnemy" }
    | { effect: "heal"; target?: "mostInjured" }
    | { effect: Exclude<Effect, "attack" | "heal"> }
  );
export const SPECIES: readonly Species[] = [
  {
    id: "mossback",
    name: "Mossback",
    title: "The gentle guardian",
    health: 32,
    color: "#9ead70",
    trait: "Rooted",
    passiveTiers: [
      {
        description: "Guard cards grant 2 extra block.",
        effects: [{ kind: "cardBonus", trigger: "guard", amount: 2 }],
      },
      null,
      null,
      null,
      null,
      null,
    ],
  },
  {
    id: "emberfox",
    name: "Emberfox",
    title: "A spark in the undergrowth",
    health: 24,
    color: "#ed9c65",
    trait: "Kindling",
    passiveTiers: [
      {
        description: "First attack each turn deals 2 extra damage.",
        effects: [{ kind: "cardBonus", trigger: "firstAttack", amount: 2 }],
      },
      null,
      null,
      null,
      null,
      null,
    ],
  },
  {
    id: "stormfin",
    name: "Stormfin",
    title: "The gathering storm",
    health: 26,
    color: "#8cbecb",
    trait: "Charged",
    passiveTiers: [
      {
        description: "Stun attacks deal 1 extra damage.",
        effects: [{ kind: "cardBonus", trigger: "stunAttack", amount: 1 }],
      },
      null,
      null,
      null,
      null,
      null,
    ],
  },
  {
    id: "silkmoth",
    name: "Silkmoth",
    title: "A little light in the dark",
    health: 23,
    color: "#d1b5d3",
    trait: "Tender",
    passiveTiers: [
      {
        description: "Health cards restore 2 extra Health.",
        effects: [{ kind: "cardBonus", trigger: "heal", amount: 2 }],
      },
      null,
      null,
      null,
      null,
      null,
    ],
  },
  {
    id: "briartooth",
    name: "Briartooth",
    title: "Wild at heart",
    health: 30,
    color: "#c7b76b",
    trait: "Thorns",
    passiveTiers: [
      {
        description:
          "Start each battle with 2 Thorns. When an attack removes Health, retaliate with current Thorns, then lose 1 stack.",
        effects: [{ kind: "battleStart", effect: "thorns", amount: 2 }],
      },
      null,
      null,
      null,
      null,
      null,
    ],
  },
  {
    id: "moonhart",
    name: "Moonhart",
    title: "Keeper of the quiet paths",
    health: 28,
    color: "#b7c6e0",
    trait: "Moonlit",
    passiveTiers: [
      {
        description: "Start each battle with 4 block.",
        effects: [{ kind: "battleStart", effect: "block", amount: 4 }],
      },
      null,
      null,
      null,
      null,
      null,
    ],
  },
  {
    id: "emberback",
    name: "Emberback",
    title: "The banked furnace",
    health: 30,
    color: "#ed9c65",
    trait: "Molten Shell",
    passiveTiers: [
      {
        description: "When your Armor breaks, deal 1 Burn damage to all enemies.",
        effects: [{ kind: "armorBreak", amount: 1 }],
      },
      {
        description: "When your Armor breaks, deal 2 Burn damage to all enemies.",
        effects: [{ kind: "armorBreak", amount: 2 }],
      },
      {
        description: "When your Armor breaks, deal 3 Burn damage to all enemies.",
        effects: [{ kind: "armorBreak", amount: 3 }],
      },
      {
        description: "When your Armor breaks, deal 4 Burn damage to all enemies.",
        effects: [{ kind: "armorBreak", amount: 4 }],
      },
      {
        description: "When your Armor breaks, deal 5 Burn damage to all enemies.",
        effects: [{ kind: "armorBreak", amount: 5 }],
      },
      {
        description: "When your Armor breaks, deal 6 Burn damage to all enemies.",
        effects: [{ kind: "armorBreak", amount: 6 }],
      },
    ],
  },
  {
    id: "pollenmoth",
    name: "Pollenmoth",
    title: "A golden wake of flowers",
    health: 23,
    color: "#dbaf52",
    trait: "Cross-Pollination",
    passiveTiers: [
      {
        description: "Light damage bounces once.",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
          },
        ],
      },
      {
        description: "Light damage bounces once, with a 50% chance to bounce twice.",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
          },
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
            chance: 0.5,
          },
        ],
      },
      {
        description: "Light damage bounces twice.",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
        ],
      },
      {
        description: "Light damage bounces twice. Health restoration has a 50% chance to bounce once.",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 1,
            chance: 0.5,
          },
        ],
      },
      {
        description:
          "Light damage bounces twice. Health restoration bounces once, with a 50% chance to bounce twice.",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 1,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 1,
            chance: 0.5,
          },
        ],
      },
      {
        description: "Light damage and Health restoration bounce twice.",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
          {
            kind: "bounce",
            effect: "heal",
            amount: 2,
          },
        ],
      },
    ],
  },
];
const card = (
  species: SpeciesId,
  name: string,
  effect: Exclude<Effect, "attack">,
  value: number,
): CardDefinition => ({
  id: `${species}-${effect}`,
  species,
  name,
  effect,
  value,
  cost: 1,
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
    ...attack("emberfox", "Cinder Strike", 8, "burn"),
    effects: [{ kind: "damage", damageType: "burn", amount: 2 }],
  },
  card("emberfox", "Warm Embers", "heal", 5),
  card("emberfox", "Ember Ward", "guard", 6),
  {
    ...attack("stormfin", "Arc Bite", 7, "stun"),
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
  {
    ...attack("emberback", "Ember Charge", 4, "physical"),
    artwork: "action.emberback.ember-charge",
    effects: [{ kind: "status", status: "armor", amount: 2 }],
  },
  {
    ...attack("emberback", "Furnace Breath", 2, "burn"),
    id: "emberback-furnace-breath",
    artwork: "action.emberback.furnace-breath",
    target: "allEnemies",
  },
  {
    ...attack("emberback", "Magma Stomp", 2, "stun"),
    id: "emberback-magma-stomp",
    artwork: "action.emberback.magma-stomp",
    target: "allEnemies",
  },
  {
    ...attack("pollenmoth", "Dazzle Burst", 3, "light"),
    artwork: "action.pollenmoth.dazzle-burst",
    target: "randomEnemy",
  },
  {
    ...card("pollenmoth", "Petal Shelter", "teamGuard", 2),
    artwork: "action.pollenmoth.petal-shelter",
  },
  {
    ...card("pollenmoth", "Bloomwake", "heal", 3),
    effect: "heal",
    artwork: "action.pollenmoth.bloomwake",
    target: "mostInjured",
  },
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
      text = `Deal ${value} ${DAMAGE_LABELS[card.damageType]} damage${card.target === "allEnemies" ? " to all enemies" : card.target === "randomEnemy" ? " to a random enemy" : ""}.`;
      break;
    case "guard":
      text = `Give an ally ${value} Block.`;
      break;
    case "heal":
      text = `Restore ${value} Health to ${card.target === "mostInjured" ? "the most injured ally" : "a living ally"}.`;
      break;
    case "teamGuard":
      text = `Allies gain ${value} Block.`;
      break;
  }
  for (const effect of card.effects ?? []) {
    text +=
      " " +
      (effect.kind === "damage"
        ? `Deal ${effect.amount} ${DAMAGE_LABELS[effect.damageType]} damage${effect.leech ? " with Leech" : ""}.`
        : effect.kind === "status"
          ? `Gain ${effect.amount} ${keywordLabel(effect.status)}.`
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
      { damageType: "burn", name: "Cinder Wisp", species: "emberfox" as const, health: 16, damage: 4 },
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
