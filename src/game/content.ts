import { DAMAGE_TYPES, keywordLabel, type DamageType, EFFECT_KEYWORDS } from "./keywords";
export { type DamageType } from "./keywords";
export type SpeciesId = "mossguard" | "emberback" | "pollenmoth" | "prismram" | "captoad";
type Effect = keyof typeof EFFECT_KEYWORDS;
type PassiveEffect =
  | { kind: "blockRetention"; amount: number }
  | { kind: "cardBonus"; trigger: "firstAttack" | "stunAttack" | "heal" | "guard"; amount: number }
  | { kind: "battleStart"; effect: "block" | "thorns" | "armor"; amount: number }
  | { kind: "poisonRetaliation"; amount: number }
  | { kind: "armorBreak"; amount: number }
  | { kind: "statusReflection"; amount: number }
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
  | { kind: "draw" | "mana" | "cleanse" | "purge" | "reflect" | "heal"; amount: number };
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
    | { effect: "guard"; target?: "self" }
    | { effect: "heal"; target?: "allAllies" | "mostInjured" }
    | { effect: Exclude<Effect, "attack" | "guard" | "heal"> }
  );
export const SPECIES: readonly Species[] = [
  {
    id: "mossguard",
    name: "Mossguard",
    title: "The gentle guardian",
    health: 32,
    color: "#9ead70",
    trait: "Overgrowth",
    passiveTiers: [
      {
        description: "Retain 10% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 10 }],
      },
      {
        description: "Retain 20% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 20 }],
      },
      {
        description: "Retain 30% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 30 }],
      },
      {
        description: "Retain 40% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 40 }],
      },
      {
        description: "Retain 50% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 50 }],
      },
      {
        description: "Retain 60% more Block between turns",
        effects: [{ kind: "blockRetention", amount: 60 }],
      },
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
        description: "When your Armor breaks, deal 1 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 1 }],
      },
      {
        description: "When your Armor breaks, deal 2 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 2 }],
      },
      {
        description: "When your Armor breaks, deal 3 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 3 }],
      },
      {
        description: "When your Armor breaks, deal 4 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 4 }],
      },
      {
        description: "When your Armor breaks, deal 5 Burn damage to all enemies",
        effects: [{ kind: "armorBreak", amount: 5 }],
      },
      {
        description: "When your Armor breaks, deal 6 Burn damage to all enemies",
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
        description: "Light damage bounces once",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 1,
          },
        ],
      },
      {
        description: "Light damage bounces once, with a 50% chance to bounce twice",
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
        description: "Light damage bounces twice",
        effects: [
          {
            kind: "bounce",
            effect: "light",
            amount: 2,
          },
        ],
      },
      {
        description: "Light damage bounces twice; Health restoration has a 50% chance to bounce once",
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
          "Light damage bounces twice; Health restoration bounces once, with a 50% chance to bounce twice",
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
        description: "Light damage and Health restoration bounce twice",
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
  {
    id: "prismram",
    name: "Prismram",
    title: "The crystal sentinel",
    health: 30,
    color: "#b7b2e2",
    trait: "Refraction",
    passiveTiers: [
      {
        description:
          "Harmful status effects you receive have a 10% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 10 }],
      },
      {
        description:
          "Harmful status effects you receive have a 20% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 20 }],
      },
      {
        description:
          "Harmful status effects you receive have a 30% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 30 }],
      },
      {
        description:
          "Harmful status effects you receive have a 40% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 40 }],
      },
      {
        description:
          "Harmful status effects you receive have a 50% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 50 }],
      },
      {
        description:
          "Harmful status effects you receive have a 60% chance to be redirected to a random enemy",
        effects: [{ kind: "statusReflection", amount: 60 }],
      },
    ],
  },
  {
    id: "captoad",
    name: "Captoad",
    title: "Beneath the spotted cap",
    health: 30,
    color: "#cb8051",
    trait: "Sporecoat",
    passiveTiers: [
      {
        description: "Retaliate with 1 Poison damage when hit",
        effects: [{ kind: "poisonRetaliation", amount: 1 }],
      },
      null,
      null,
      null,
      null,
      null,
    ],
  },
];
const card = <T extends Exclude<Effect, "attack">>(
  species: SpeciesId,
  name: string,
  effect: T,
  value: number,
): CardBase & { effect: T } => ({
  id: `${species}-${effect}`,
  species,
  name,
  effect,
  value,
  cost: 1,
});
const attack = (
  species: SpeciesId,
  name: string,
  value: number,
  damageType: DamageType,
): Extract<CardDefinition, { effect: "attack" }> => ({
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
    ...card("mossguard", "Boulder Brace", "guard", 6),
    target: "self",
    artwork: "action.mossguard.boulder-brace",
  },
  {
    ...attack("mossguard", "Rooted Stomp", 2, "stun"),
    target: "allEnemies",
    artwork: "action.mossguard.rooted-stomp",
  },
  {
    ...card("mossguard", "Moss Renewal", "heal", 2),
    target: "allAllies",
    artwork: "action.mossguard.moss-renewal",
  },
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
  {
    ...attack("prismram", "Prism Charge", 6, "physical"),
    artwork: "action.prismram.prism-charge",
  },
  {
    ...card("prismram", "Faceted Ward", "guard", 3),
    target: "self",
    artwork: "action.prismram.faceted-ward",
    effects: [{ kind: "reflect", amount: 1 }],
  },
  {
    ...attack("prismram", "Spectrum Lance", 4, "light"),
    id: "prismram-spectrum-lance",
    artwork: "action.prismram.spectrum-lance",
    effects: [{ kind: "purge", amount: 1 }],
  },
  {
    ...attack("captoad", "Spore Puff", 2, "poison"),
    target: "allEnemies",
    artwork: "action.captoad.spore-puff",
  },
  {
    ...card("captoad", "Mushroom Guard", "guard", 3),
    target: "self",
    effects: [{ kind: "heal", amount: 3 }],
    artwork: "action.captoad.mushroom-guard",
  },
  {
    ...card("captoad", "Bogbound Leap", "swap", 1),
    effects: [{ kind: "draw", amount: 2 }],
    artwork: "action.captoad.bogbound-leap",
  },
];
export function enemyCard(card: CardDefinition): CardDefinition {
  return {
    ...card,
    effects: card.effects?.filter((effect) =>
      ["damage", "status", "cleanse", "purge", "reflect", "heal"].includes(effect.kind),
    ),
  };
}
export const INITIAL_SPECIES = SPECIES.map((s) => s.id);
export const FIRST_RUN_STARTERS: readonly SpeciesId[] = INITIAL_SPECIES;
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
      text = `Deal ${value} ${DAMAGE_LABELS[card.damageType]} damage${card.target === "allEnemies" ? " to all enemies" : card.target === "randomEnemy" ? " to a random enemy" : ""}`;
      break;
    case "guard":
      text = card.target === "self" ? `Gain ${value} Block` : `Give an ally ${value} Block`;
      break;
    case "heal":
      text = `Restore ${value} Health to ${card.target === "allAllies" ? "all allies" : card.target === "mostInjured" ? "the most injured ally" : "a living ally"}`;
      break;
    case "swap":
      text = "Swap out for a random backup";
      break;
    case "teamGuard":
      text = `Allies gain ${value} Block`;
      break;
  }
  for (const effect of card.effects ?? []) {
    text +=
      "; " +
      (effect.kind === "damage"
        ? `Deal ${effect.amount} ${DAMAGE_LABELS[effect.damageType]} damage${effect.leech ? " with Leech" : ""}`
        : effect.kind === "status"
          ? `Gain ${effect.amount} ${keywordLabel(effect.status)}`
          : effect.kind === "draw"
            ? `Draw ${effect.amount} card${effect.amount === 1 ? "" : "s"}`
            : effect.kind === "mana"
              ? `Restore ${effect.amount} Mana`
              : effect.kind === "heal"
                ? `Restore ${effect.amount} Health`
                : effect.kind === "reflect"
                  ? "Reflect the next harmful status effect"
                  : `${effect.kind === "cleanse" ? "Cleanse acting creature" : "Purge target"}: remove ${effect.amount} effect${effect.amount === 1 ? "" : "s"}`);
  }
  if (card.leech) text += "; Leech";
  return text;
}
/** Stable legacy route; new expeditions use the saved packs in encounters.ts. */
export const ENCOUNTERS = [
  {
    name: "The overgrown trail",
    enemies: [
      { damageType: "burn", name: "Emberback", species: "emberback" as const, health: 18, damage: 4 },
      { damageType: "light", name: "Pollenmoth", species: "pollenmoth" as const, health: 16, damage: 4 },
      { damageType: "nature", name: "Mossguard", species: "mossguard" as const, health: 16, damage: 4 },
    ],
  },
  {
    name: "Beyond the fernwood",
    enemies: [
      {
        damageType: "physical",
        name: "Prismram",
        species: "prismram" as const,
        health: 24,
        damage: 5,
      },
      { damageType: "light", name: "Pollenmoth", species: "pollenmoth" as const, health: 22, damage: 5 },
      { damageType: "nature", name: "Mossguard", species: "mossguard" as const, health: 18, damage: 4 },
    ],
  },
  {
    name: "Heart of the wilds",
    enemies: [
      { damageType: "light", name: "The Hollow Crown", species: "prismram" as const, health: 68, damage: 10 },
    ],
  },
] as const;
