import { freeze } from "immer";
import { MAX_HAND_SIZE } from "./engine";
import { z } from "zod";
import { CARDS, INITIAL_SPECIES, SPECIES, species } from "./content";
import { BIOMES, location, encounterSource, finalEncounter, bossEncounter } from "./destinations";
import { KEYWORDS, RELICS, TALENTS, talentPoints } from "./progression";
import type { GameState } from "./types";
const natural = z.number().int().min(0).max(1_000_000);
const id = z.string().min(1).max(120);
const speciesId = z.enum(["mossback", "emberfox", "stormfin", "silkmoth", "briartooth", "moonhart"]);
const xp = z.partialRecord(z.enum(KEYWORDS), natural);
const relicId = z.enum(RELICS.map((r) => r.id));
const battle = z
  .object({
    turn: z.number().int().min(1).max(1_000_000),
    mana: z.number().int().min(0).max(3),
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
          marks: natural,
          targetId: id,
        }),
      )
      .min(1)
      .max(3),
  })
  .nullable();
const creature = z.object({ id, species: speciesId, health: natural, block: natural, attacked: z.boolean() });
const currentShape = z.object({
  version: z.literal(9),
  revision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  rng: z.number().int().min(0).max(0xffffffff),
  phase: z.enum(["draft", "teamSelection", "battle", "recruit", "relic", "victory", "defeat"]),
  unlocked: z.array(speciesId).min(5).max(6),
  wins: natural,
  selected: z.array(speciesId).max(1),
  roster: z.array(speciesId).max(5),
  team: z.array(creature).max(3),
  reserves: z.array(creature).max(2),
  lineup: z.array(id).max(3),
  cards: z
    .array(z.object({ id, definitionId: id, ownerId: id, level: z.number().int().min(0).max(3) }))
    .max(9),
  encounter: z
    .number()
    .int()
    .min(0)
    .max(BIOMES.length * 4 - 1),
  expedition: z
    .object({
      biome: z
        .number()
        .int()
        .min(0)
        .max(BIOMES.length - 1),
      step: z.number().int().min(0).max(3),
      offers: z.array(z.object({ location: id, pack: z.number().int().min(0).max(10) })).max(3),
      chosen: id.nullable(),
    })
    .nullable(),
  battle,
  keywordXP: xp,
  battleXP: xp,
  talents: z.array(z.enum(TALENTS.map((t) => t.id))).max(TALENTS.length),
  currency: natural,
  relics: z.array(relicId).max(RELICS.length),
  reward: z
    .object({
      xp,
      currency: natural,
      recruits: z.array(speciesId).max(3),
      relics: z.array(relicId).max(3),
      outcome: z.enum(["next", "victory", "defeat"]),
    })
    .nullable(),
  journey: z
    .object({
      outcome: z.enum(["victory", "defeat", "returned"]).nullable(),
      victories: z
        .number()
        .int()
        .min(0)
        .max(BIOMES.length * 4),
      currency: natural,
      xp,
      unlocks: z.array(speciesId).max(6),
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
  if (s.journey) {
    const summary = s.journey;
    invalid(
      s.phase === "draft" ||
        !unique(summary.unlocks) ||
        summary.unlocks.some((kind) => !s.unlocked.includes(kind)),
    );
    invalid(
      summary.currency > s.currency ||
        KEYWORDS.some((keyword) => (summary.xp[keyword] ?? 0) > (s.keywordXP[keyword] ?? 0)),
    );
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
    const route = s.expedition,
      biome = BIOMES[route.biome]!;
    invalid(s.encounter !== route.biome * 4 + route.step);
    const places: readonly string[] = route.step === 3 ? [biome.boss] : biome.locations;
    invalid(
      !unique(route.offers.map((offer) => offer.location)) ||
        route.offers.some(
          (offer) => !places.includes(offer.location) || !location(offer.location)?.packs[offer.pack],
        ),
    );
    if (s.phase === "draft") invalid(route.offers.length !== 0 || route.chosen !== null || s.encounter !== 0);
    else {
      invalid(route.offers.length !== (route.step === 3 ? 1 : 3));
      invalid(
        s.phase === "teamSelection" || (s.phase === "defeat" && !s.battle)
          ? route.chosen !== null
          : !route.offers.some((offer) => offer.location === route.chosen),
      );
    }
  } else invalid(s.encounter > 2);
  invalid(
    !unique(s.unlocked) ||
      !unique(s.selected) ||
      INITIAL_SPECIES.some((kind) => !s.unlocked.includes(kind)) ||
      s.selected.some((kind) => !s.unlocked.includes(kind)) ||
      s.roster.some((kind) => !s.unlocked.includes(kind)) ||
      s.wins > 0 !== s.unlocked.includes("moonhart"),
  );
  invalid(
    !unique([...s.team, ...s.reserves].map((c) => c.id)) ||
      !unique(s.lineup) ||
      s.lineup.some((id) => ![...s.team, ...s.reserves].some((c) => c.id === id)) ||
      !unique(s.cards.map((c) => c.id)) ||
      !unique(s.talents) ||
      !unique(s.relics),
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
  if (s.phase === "teamSelection")
    invalid(s.battle !== null || s.reward !== null || s.team.some((c, index) => c.id !== s.lineup[index]));
  if (["battle", "recruit", "relic"].includes(s.phase)) invalid(!s.battle);
  const rewardPhase = ["recruit", "relic"].includes(s.phase);
  invalid(rewardPhase && !s.reward);
  invalid(!rewardPhase && s.reward !== null && !["victory", "defeat"].includes(s.phase));
  if (s.phase !== "battle") invalid(Object.values(s.battleXP).some((n) => n !== 0));
  if (s.reward) {
    invalid(s.reward.recruits.length > 0 && s.reward.relics.length > 0);
    invalid(bossEncounter(s) ? s.reward.recruits.length > 0 : s.reward.relics.length > 0);
    invalid(
      !unique(s.reward.relics) ||
        (s.reward.recruits.length > 0 &&
          JSON.stringify(s.reward.recruits) !==
            JSON.stringify(encounterSource(s).enemies.map((e) => e.species))),
    );
    invalid(
      (s.reward.outcome === "next" && finalEncounter(s)) ||
        (s.reward.outcome === "victory" && !finalEncounter(s)),
    );
    if (s.phase === "recruit") invalid(s.reward.recruits.length !== 3 || s.reward.outcome !== "next");
    if (s.phase === "relic")
      invalid(
        s.reward.relics.length !== 3 ||
          s.reward.relics.some((r) => s.relics.includes(r)) ||
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
          !s.team.some((c) => c.id === enemy.targetId),
      );
    });
    const zones = [...b.draw, ...b.hand, ...b.buffer, ...b.discard];
    invalid(!unique(zones) || zones.some((id) => !s.cards.some((c) => c.id === id)));
    if (s.phase === "battle") {
      const liveCards = s.cards;
      invalid(
        b.mana === 0 ||
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
  return freeze(s, true) as GameState;
}
export function encodeSave(state: GameState) {
  return JSON.stringify(state);
}
export function validateContent() {
  if (!unique(SPECIES.map((s) => s.id)) || !unique(CARDS.map((c) => c.id)))
    throw new Error("Duplicate content IDs.");
  for (const creature of SPECIES)
    if (CARDS.filter((c) => c.species === creature.id).length !== 3)
      throw new Error(`${creature.name} must contribute three cards.`);
}
