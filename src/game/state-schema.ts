import { PLAYER_CARD_TRIGGER_LIMIT } from "./rules/boons";
import { z } from "zod";
import saveFormat from "./save-format.json" with { type: "json" };
import { MAX_BATTLE_CARDS, MAX_HAND_SIZE } from "./card-zones";
import { MAX_CREATURE_STARS, KEYWORDS } from "./progression";
import { SPECIES, BOONS, TALENTS } from "./content";
import { JOURNEY_LENGTH } from "./encounters";
import { MAX_REVISION } from "./state-limits";
const natural = z.number().int().min(0).max(1_000_000);
const id = z.string().min(1).max(120);
const speciesId = z.enum(SPECIES.map((entry) => entry.id));
const xp = z.partialRecord(z.enum(KEYWORDS), natural);
const boonId = z.enum(BOONS.map((r) => r.id));
const combatStateSchema = z
  .object({
    controlTurns: z.number().int().min(0).max(2),
    rhythm: z.number().int().min(0).max(70),
    nextPhysical: z.number().int().min(0).max(2),
    partingCut: z.boolean(),
    riposte: z.boolean(),
    freeNature: z.boolean(),
    freeLight: z.boolean(),
    freeCard: z.boolean(),
    reflect: z.boolean(),
    reflectBurn: z.boolean(),
    nullify: z.boolean(),
    nullifyFreeze: z.boolean(),
    negate: z.boolean(),
    attackReflection: z.boolean(),
    fallenCardsPlayedThisTurn: z.number().int().min(0).max(6),
    cardsPlayedThisTurn: z.number().int().min(0).max(2),
    encoreUsed: z.boolean(),
    firstAttackUsed: z.boolean(),
    desperateGuardUsed: z.boolean(),
    armor: natural,
    thorns: natural,
    waterThorns: natural,
    dodge: z.number().int().min(0).max(70),
    temporaryDodge: z.number().int().min(0).max(70),
    blind: z.boolean(),
    burn: natural,
    poison: natural,
    bleed: natural,
    stun: natural,
    freeze: natural,
    controlled: z.enum(["stun", "freeze"]).nullable(),
    cooldown: z.number().int().min(0).max(3),
    skipped: z.boolean(),
    deathDoorUsed: z.boolean(),
    grace: z.number().int().min(0).max(3),
    statusSources: z.partialRecord(z.enum(["burn", "poison", "bleed"]), id),
    bleedLeech: z.array(z.object({ sourceId: id, amount: natural })).max(9),
  })
  .strict();
const enemyDeck = z.object({
  draw: z.array(id).max(MAX_BATTLE_CARDS),
  hand: z.array(id).max(MAX_HAND_SIZE),
  buffer: z.array(id).max(MAX_BATTLE_CARDS),
  discard: z.array(id).max(MAX_BATTLE_CARDS),
  mana: z.number().int().min(0).max(4),
  pearls: z
    .number()
    .int()
    .min(0)
    .max(MAX_BATTLE_CARDS - 6),
});
const minion = z.object({
  id,
  name: z.literal("Echo"),
  species: z.literal("memento"),
  health: natural,
  maxHealth: natural,
  power: z.number().min(1).max(2),
  targetId: id,
  block: natural,
  combat: combatStateSchema,
  lastAbility: z.null(),
  minion: z.object({ ownerId: id, side: z.enum(["player", "enemy"]) }),
});
const battle = z.object({
  repeatNext: z.object({ player: z.boolean(), enemy: z.boolean() }).strict(),
  minions: z.array(minion).max(12).optional(),
  copySerial: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  earnedGold: natural,
  freeBurnUsed: z.boolean(),
  meteoriteUsed: z.boolean(),
  cardsPlayedThisTurn: z.number().int().min(0).max(PLAYER_CARD_TRIGGER_LIMIT),
  turn: z.number().int().min(1).max(1_000_000),
  mana: z.number().int().min(0).max(6),
  maxMana: z.number().int().min(4).max(6),
  draw: z.array(id).max(MAX_BATTLE_CARDS),
  hand: z.array(id).max(MAX_HAND_SIZE),
  buffer: z.array(id).max(MAX_BATTLE_CARDS),
  discard: z.array(id).max(MAX_BATTLE_CARDS),
  enemies: z
    .array(
      z.object({
        id,
        name: z.string().max(100),
        species: speciesId,
        health: natural,
        maxHealth: natural,
        power: z.number().min(1).max(2),
        targetId: id,
        block: natural,
        combat: combatStateSchema,
        lastAbility: id.nullable(),
        deck: enemyDeck.optional(),
      }),
    )
    .min(1)
    .max(3),
});
const creature = z.object({
  id,
  species: speciesId,
  health: natural,
  block: natural,
  attacked: z.boolean(),
  combat: combatStateSchema.optional(),
});
const shared = z.object({
  version: z.literal(saveFormat.version),
  discovery: z.object({
    encountered: z.array(speciesId).max(SPECIES.length),
    recruited: z.partialRecord(
      speciesId,
      z
        .number()
        .int()
        .min(1)
        .max(MAX_CREATURE_STARS + 1),
    ),
  }),
  revision: z.number().int().nonnegative().max(MAX_REVISION),
  rng: z.number().int().min(0).max(0xffffffff),
  wins: natural,
  selected: z.array(speciesId).max(3),
  starterOffers: z.array(speciesId).max(3),
  team: z.array(creature).max(3),
  reserves: z.array(creature).max(4),
  cards: z
    .array(
      z.object({
        id,
        definitionId: id,
        ownerId: id.nullable(),
        level: z.number().int().min(0).max(3),
        temporary: z.literal(true).optional(),
      }),
    )
    .max(MAX_BATTLE_CARDS),
  encounter: z
    .number()
    .int()
    .min(0)
    .max(JOURNEY_LENGTH - 1),
  keywordXP: xp,
  battleXP: xp,
  talents: z
    .array(z.enum(TALENTS.map((t) => t.id)))
    .max(TALENTS.length)
    .transform((ids): string[] => ids),
  currency: natural,
  boons: z.array(boonId).max(BOONS.length),
});

const expedition = z.object({
  pack: z.array(speciesId).min(1).max(3).nullable(),
  recruit: speciesId.nullable(),
  lastRoom: z.enum(["combat", "boss", "merchant", "campfire", "recruit"]).nullable(),
});
const support = z
  .object({
    id,
    kind: z.literal("merchant"),
    encounter: z
      .number()
      .int()
      .min(0)
      .max(JOURNEY_LENGTH - 1),
    resolved: z.boolean(),
    purchased: boonId.nullable(),
    stock: z
      .array(z.object({ slot: id, boon: boonId, price: z.number().int().min(1).max(1_000_000) }))
      .max(3),
  })
  .nullable();
const receipt = z.object({
  xp,
  currency: natural,
  recruits: z.array(speciesId).max(3),
  boons: z.array(boonId).max(3),
  outcome: z.enum(["next", "victory", "defeat"]),
});
const journey = z.object({
  outcome: z.enum(["victory", "defeat", "returned"]).nullable(),
  victories: z.number().int().min(0).max(JOURNEY_LENGTH),
  currency: natural,
  xp,
  lastBattle: z
    .object({
      xp,
      currency: natural,
      encounter: z
        .number()
        .int()
        .min(0)
        .max(JOURNEY_LENGTH - 1),
      outcome: z.enum(["next", "victory", "defeat"]),
    })
    .nullable(),
});

const activeJourney = journey.extend({ outcome: z.null() });
const destination = { battle: z.null(), reward: z.null(), journey: activeJourney, expedition, support };
const finished = { battle: z.null(), expedition, support: z.null() };

const phases = z.discriminatedUnion("phase", [
  shared.extend({ phase: z.literal("draft"), ...destination, journey: z.null(), support: z.null() }),
  shared.extend({ phase: z.literal("teamSelection"), ...destination }),
  shared.extend({ phase: z.literal("campfire"), ...destination, expedition }),
  shared.extend({
    phase: z.literal("support"),
    ...destination,
    expedition,
    support: support.unwrap(),
  }),
  shared.extend({
    phase: z.literal("battle"),
    battle,
    reward: z.null(),
    journey: activeJourney,
    expedition,
    support: z.null(),
  }),
  shared.extend({
    phase: z.literal("recruit"),
    ...finished,
    journey: activeJourney,
    reward: receipt.extend({
      outcome: z.enum(["next", "victory"]),
      recruits: z.array(speciesId).min(1).max(3),
      selectedRecruit: speciesId.optional(),
      boons: z.array(boonId).max(3),
    }),
  }),
  shared.extend({
    phase: z.literal("boon"),
    ...finished,
    journey: activeJourney,
    reward: receipt.extend({
      outcome: z.literal("next"),
      recruits: z.array(speciesId).length(0),
      boons: z.array(boonId).min(1).max(3),
    }),
  }),
  shared.extend({
    phase: z.literal("victory"),
    ...finished,
    journey: journey.extend({ outcome: z.literal("victory") }),
    reward: receipt.extend({
      outcome: z.literal("victory"),
      recruits: z.array(speciesId).length(0),
      boons: z.array(boonId).length(0),
    }),
  }),
]);

// Voluntary return and combat defeat share a player surface, but have different receipts.
export const gameStateSchema = z.union([
  phases,
  shared.extend({
    phase: z.literal("defeat"),
    ...finished,
    journey: journey.extend({ outcome: z.literal("defeat") }),
    reward: receipt.extend({
      outcome: z.literal("defeat"),
      recruits: z.array(speciesId).length(0),
      boons: z.array(boonId).length(0),
    }),
  }),
  shared.extend({
    phase: z.literal("defeat"),
    ...finished,
    journey: journey.extend({ outcome: z.literal("returned") }),
    reward: z.null(),
  }),
]);
