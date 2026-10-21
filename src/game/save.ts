import { needsCampfire } from "./support";
import { freeze } from "immer";
import { MAX_HAND_SIZE, starterCount } from "./engine";
import { z } from "zod";
import { CARDS, INITIAL_SPECIES, SPECIES, FIRST_RUN_STARTERS, species } from "./content";
import { JOURNEY_LENGTH, encounterPacks, encounterSource, finalEncounter, bossEncounter } from "./encounters";
import { collectedSpecies, MAX_CREATURE_STARS, KEYWORDS, BOONS, TALENTS, talentPoints } from "./progression";
import type { GameState } from "./types";
const natural = z.number().int().min(0).max(1_000_000);
const id = z.string().min(1).max(120);
const speciesId = z.enum(SPECIES.map((entry) => entry.id));
const xp = z.partialRecord(z.enum(KEYWORDS), natural);
const boonId = z.enum(BOONS.map((r) => r.id));
const combatState = z
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
    desperateGuardUsed: z.boolean(),
    armor: natural,
    thorns: natural,
    dodge: z.number().int().min(0).max(70),
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
const battle = z
  .object({
    earnedGold: natural,
    freeBurnUsed: z.boolean(),
    meteoriteUsed: z.boolean(),
    cardsPlayedThisTurn: z.number().int().min(0).max(3),
    turn: z.number().int().min(1).max(1_000_000),
    mana: z.number().int().min(0).max(6),
    maxMana: z.number().int().min(4).max(6),
    draw: z.array(id).max(9),
    hand: z.array(id).max(MAX_HAND_SIZE),
    buffer: z.array(id).max(9),
    discard: z.array(id).max(9),
    enemies: z
      .array(
        z.object({
          id,
          name: z.string().max(100),
          species: speciesId,
          health: natural,
          maxHealth: natural,
          damage: natural,
          targetId: id,
          block: natural,
          combat: combatState,
          lastAbility: id.nullable(),
        }),
      )
      .min(1)
      .max(3),
  })
  .nullable();
const creature = z.object({
  id,
  species: speciesId,
  health: natural,
  block: natural,
  attacked: z.boolean(),
  combat: combatState.optional(),
});
const currentShape = z.object({
  version: z.literal(26),
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
  revision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  rng: z.number().int().min(0).max(0xffffffff),
  phase: z.enum([
    "draft",
    "teamSelection",
    "battle",
    "recruit",
    "boon",
    "campfire",
    "support",
    "victory",
    "defeat",
  ]),
  unlocked: z.array(speciesId).min(INITIAL_SPECIES.length).max(SPECIES.length),
  wins: natural,
  selected: z.array(speciesId).max(3),
  starterOffers: z.array(speciesId).max(3),
  roster: z.array(speciesId).max(5),
  team: z.array(creature).max(3),
  reserves: z.array(creature).max(2),
  lineup: z.array(id).max(3),
  cards: z
    .array(
      z.object({
        id,
        definitionId: id,
        ownerId: id,
        level: z.number().int().min(0).max(3),
      }),
    )
    .max(9),
  encounter: z
    .number()
    .int()
    .min(0)
    .max(JOURNEY_LENGTH - 1),
  expedition: z
    .object({
      pack: z.number().int().min(0).max(100).nullable(),
    })
    .nullable(),
  support: z
    .object({
      id,
      kind: z.literal("merchant"),
      encounter: z.union([z.literal(1), z.literal(5)]),
      resolved: z.boolean(),
      purchased: boonId.nullable(),
      stock: z
        .array(z.object({ slot: id, boon: boonId, price: z.number().int().min(1).max(1_000_000) }))
        .max(2),
    })
    .nullable(),
  battle,
  keywordXP: xp,
  battleXP: xp,
  talents: z.array(z.enum(TALENTS.map((t) => t.id))).max(TALENTS.length),
  currency: natural,
  boons: z.array(boonId).max(BOONS.length),
  reward: z
    .object({
      xp,
      currency: natural,
      recruits: z.array(speciesId).max(3),
      boons: z.array(boonId).max(3),
      outcome: z.enum(["next", "victory", "defeat"]),
    })
    .nullable(),
  journey: z
    .object({
      outcome: z.enum(["victory", "defeat", "returned"]).nullable(),
      victories: z.number().int().min(0).max(JOURNEY_LENGTH),
      currency: natural,
      xp,
      unlocks: z.array(speciesId).max(0),
      lastBattle: z.object({ xp, currency: natural }).nullable(),
    })
    .nullable(),
});
const unique = (values: unknown[]) => new Set(values).size === values.length;
export function decodeSave(raw: string): GameState {
  if (raw.length > 100_000) throw new Error("Save exceeds the supported size.");
  const s = currentShape.parse(JSON.parse(raw));
  const invalid = (condition: boolean) => {
    if (condition) throw new Error("Save contains inconsistent game data.");
  };
  invalid(!unique(s.discovery.encountered));
  invalid(
    SPECIES.some(
      ({ id }) => s.discovery.recruited[id] !== undefined && !s.discovery.encountered.includes(id),
    ),
  );
  const collected = collectedSpecies(s);
  const starterPool = collected.length ? collected : FIRST_RUN_STARTERS;
  const drafting = s.phase === "draft" && s.selected.length < starterCount(s);
  invalid(
    new Set(s.starterOffers).size !== (drafting ? Math.min(3, starterPool.length) : 0) ||
      s.starterOffers.some((kind) => !starterPool.includes(kind)) ||
      s.starterOffers.length !== (drafting ? 3 : 0),
  );
  if (s.journey) {
    const summary = s.journey;
    invalid(
      s.phase === "draft" ||
        !unique(summary.unlocks) ||
        summary.unlocks.some((kind) => !s.unlocked.includes(kind)),
    );
    invalid(KEYWORDS.some((keyword) => (summary.xp[keyword] ?? 0) > (s.keywordXP[keyword] ?? 0)));
    invalid(
      s.phase === "victory"
        ? summary.outcome !== "victory"
        : s.phase === "defeat"
          ? !["defeat", "returned"].includes(summary.outcome ?? "")
          : summary.outcome !== null,
    );
    // Choice screens retain the just-won battle; destinations have already advanced the encounter.
    invalid(
      summary.victories !==
        s.encounter +
          (s.phase === "victory" ||
          (s.battle?.enemies.every((enemy) => enemy.health === 0) && summary.outcome !== "defeat")
            ? 1
            : 0),
    );
    if (summary.lastBattle)
      invalid(
        summary.lastBattle.currency > summary.currency ||
          KEYWORDS.some((keyword) => (summary.lastBattle!.xp[keyword] ?? 0) > (summary.xp[keyword] ?? 0)),
      );
  }
  if (s.expedition) {
    const route = s.expedition;
    if (s.phase === "draft") invalid(route.pack !== null || s.encounter !== 0);
    else invalid(route.pack === null || !encounterPacks(s.encounter)[route.pack]);
  } else invalid(s.encounter > 2);
  invalid(
    !unique(s.unlocked) ||
      INITIAL_SPECIES.some((kind) => !s.unlocked.includes(kind)) ||
      s.selected.some((kind) => !starterPool.includes(kind)) ||
      (s.phase === "draft" && s.selected.length > starterCount(s)) ||
      (s.phase !== "draft" && !collected.length),
  );
  invalid(
    !unique([...s.team, ...s.reserves].map((c) => c.id)) ||
      !unique(s.lineup) ||
      s.lineup.some((id) => ![...s.team, ...s.reserves].some((c) => c.id === id)) ||
      !unique(s.cards.map((c) => c.id)) ||
      !unique(s.talents) ||
      !unique(s.boons),
  );
  invalid(
    [...s.team, ...s.reserves].some(
      (c) => !s.roster.includes(c.species) || c.health > species(c.species).health,
    ) ||
      s.roster.length !== s.team.length + s.reserves.length ||
      s.roster.some(
        (kind) =>
          s.roster.filter((k) => k === kind).length !==
          [...s.team, ...s.reserves].filter((c) => c.species === kind).length,
      ),
  );
  invalid(
    s.cards.some(
      (c) =>
        !s.team.some(
          (t) => t.id === c.ownerId && CARDS.some((d) => d.id === c.definitionId && d.species === t.species),
        ),
    ),
  );
  for (const creature of s.team)
    for (const def of CARDS.filter((d) => d.species === creature.species))
      invalid(s.cards.filter((c) => c.ownerId === creature.id && c.definitionId === def.id).length !== 1);
  for (const keyword of KEYWORDS) {
    const bought = TALENTS.filter((t) => t.keyword === keyword && s.talents.includes(t.id));
    invalid(bought.length > talentPoints(s.keywordXP[keyword] ?? 0));
    for (const talent of bought)
      invalid(TALENTS.some((t) => t.keyword === keyword && t.row < talent.row && !s.talents.includes(t.id)));
  }
  if (s.phase === "draft")
    invalid(
      s.team.length !== 0 ||
        s.cards.length !== 0 ||
        s.roster.length !== 0 ||
        s.reserves.length !== 0 ||
        s.lineup.length !== 0 ||
        s.battle !== null ||
        s.reward !== null,
    );
  else
    invalid(
      s.team.length < 1 ||
        s.team.length !== Math.min(3, s.roster.length) ||
        s.cards.length !== s.team.length * 3 ||
        s.lineup.length !== s.team.length,
    );
  if (s.phase === "teamSelection" || s.phase === "support" || s.phase === "campfire")
    invalid(s.battle !== null || s.reward !== null || s.team.some((c, index) => c.id !== s.lineup[index]));
  if (s.phase === "support") invalid(!s.support || !s.expedition);
  if (s.support) {
    const v = s.support;
    invalid(
      !s.expedition ||
        v.encounter !== s.encounter ||
        v.id !== `support-${v.encounter}` ||
        !["teamSelection", "support", "campfire"].includes(s.phase) ||
        !v.stock.length ||
        !unique(v.stock.map((r) => r.slot)) ||
        !unique(v.stock.map((r) => r.boon)) ||
        v.stock.some(
          (r, i) => r.slot !== `slot-${i}` || (s.boons.includes(r.boon) && v.purchased !== r.boon),
        ) ||
        (v.purchased !== null &&
          (!v.resolved || !s.boons.includes(v.purchased) || !v.stock.some((r) => r.boon === v.purchased))),
    );
  }
  if (s.phase === "campfire") invalid(!s.expedition || !needsCampfire(s));
  if (["battle", "recruit", "boon"].includes(s.phase)) invalid(!s.battle);
  const rewardPhase = ["recruit", "boon"].includes(s.phase);
  invalid(rewardPhase && !s.reward);
  invalid(!rewardPhase && s.reward !== null && !["victory", "defeat"].includes(s.phase));
  if (s.phase !== "battle") invalid(Object.values(s.battleXP).some((n) => n !== 0));
  if (s.reward) {
    invalid(s.reward.recruits.length > 0 && s.reward.boons.length > 0);
    invalid(bossEncounter(s) ? s.reward.recruits.length > 0 : s.reward.boons.length > 0);
    invalid(
      !unique(s.reward.boons) ||
        (s.reward.recruits.length > 0 &&
          JSON.stringify(s.reward.recruits) !==
            JSON.stringify(encounterSource(s).enemies.map((e) => e.species))),
    );
    invalid(
      (s.reward.outcome === "next" && finalEncounter(s)) ||
        (s.reward.outcome === "victory" && !finalEncounter(s)),
    );
    if (s.phase === "recruit")
      invalid(s.reward.recruits.length !== encounterSource(s).enemies.length || s.reward.outcome !== "next");
    if (s.phase === "boon")
      invalid(
        s.reward.boons.length < 1 ||
          s.reward.boons.some((r) => s.boons.includes(r)) ||
          s.reward.outcome === "defeat",
      );
    if (s.reward.outcome === "defeat") invalid([...s.team, ...s.reserves].some((c) => c.health > 0));
    if (s.reward.outcome !== "defeat") invalid(s.battle?.enemies.some((e) => e.health > 0) ?? true);
  }
  if (s.battle) {
    const b = s.battle,
      source = encounterSource(s);
    invalid(b.enemies.length !== source.enemies.length || !unique(b.enemies.map((e) => e.id)));
    b.enemies.forEach((enemy, index) => {
      const original = source.enemies[index];
      invalid(
        !original ||
          enemy.id !== `enemy-${index}` ||
          enemy.species !== original.species ||
          enemy.name !== original.name ||
          enemy.maxHealth !== original.health ||
          enemy.damage !== original.damage ||
          enemy.health > enemy.maxHealth ||
          (enemy.lastAbility !== null &&
            !CARDS.some((card) => card.id === enemy.lastAbility && card.species === enemy.species)) ||
          enemy.combat.deathDoorUsed ||
          enemy.combat.grace > 0 ||
          !s.team.some((c) => c.id === enemy.targetId),
      );
    });
    const zones = [...b.draw, ...b.hand, ...b.buffer, ...b.discard];
    // The current turn capacity survives a category reset.
    invalid(
      b.mana > b.maxMana ||
        b.earnedGold > s.currency ||
        (s.journey !== null && b.earnedGold > s.journey.currency),
    );
    invalid(!unique(zones) || zones.some((id) => !s.cards.some((c) => c.id === id)));
    if (s.phase === "battle") {
      invalid([...s.team, ...s.reserves].some((creature) => !creature.combat));
      const liveCards = s.cards;
      invalid(
        ![...s.team, ...s.reserves].some((c) => c.health > 0) ||
          !b.enemies.some((e) => e.health > 0) ||
          (b.buffer.length > 0 && b.hand.length < MAX_HAND_SIZE) ||
          zones.length !== liveCards.length ||
          liveCards.some((c) => !zones.includes(c.id)),
      );
    }
  }
  invalid(
    s.phase === "victory" &&
      (!finalEncounter(s) || s.wins === 0 || !s.battle || s.battle.enemies.some((e) => e.health > 0)),
  );
  const allCombatants = [...s.team, ...s.reserves, ...(s.battle?.enemies ?? [])];
  for (const unit of allCombatants)
    if (unit.combat) {
      const stats = unit.combat;
      invalid((stats.grace > 0 && !stats.deathDoorUsed) || (stats.controlled !== null && stats.cooldown > 0));
      invalid(
        Object.values(stats.statusSources).some((id) => !allCombatants.some((unit) => unit.id === id)) ||
          stats.bleedLeech.reduce((sum, row) => sum + row.amount, 0) > stats.bleed ||
          stats.bleedLeech.some((row) => !allCombatants.some((source) => source.id === row.sourceId)),
      );
    }
  return freeze(s, true) as GameState;
}
export function encodeSave(state: GameState) {
  return JSON.stringify(state);
}
export { validateContent } from "./content-validation";
