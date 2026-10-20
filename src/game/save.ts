import { freeze } from "immer";
import { z } from "zod";
import { createGame, dispatch } from "./engine";
import { CARDS, ENCOUNTERS, INITIAL_SPECIES, SPECIES, species } from "./content";
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
    hand: z.array(id).max(9),
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
const oldShape = z.object({
  version: z.literal(2),
  revision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  rng: z.number().int().min(0).max(0xffffffff),
  phase: z.enum(["draft", "battle", "reward", "victory", "defeat"]),
  unlocked: z.array(speciesId).min(5).max(6),
  wins: natural,
  selected: z.array(speciesId).max(3),
  team: z
    .array(z.object({ id, species: speciesId, health: natural, block: natural, attacked: z.boolean() }))
    .max(3),
  cards: z
    .array(z.object({ id, definitionId: id, ownerId: id, level: z.number().int().min(0).max(3) }))
    .max(9),
  encounter: z.number().int().min(0).max(2),
  battle,
});
const shape = oldShape.extend({
  version: z.literal(3),
  phase: z.enum(["draft", "teamSelection", "battle", "reward", "recruit", "relic", "victory", "defeat"]),
  roster: z.array(speciesId).max(6),
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
});
const creatureShape = oldShape.shape.team.element;
const currentShape = shape.extend({
  version: z.literal(4),
  roster: z.array(speciesId).max(5),
  reserves: z.array(creatureShape).max(2),
  lineup: z.array(speciesId).max(3),
});
const unique = (values: unknown[]) => new Set(values).size === values.length;
export function decodeSave(raw: string): GameState {
  if (raw.length > 100_000) throw new Error("Save exceeds the supported size.");
  let input: unknown = JSON.parse(raw);
  const legacy =
    !!input &&
    typeof input === "object" &&
    "version" in input &&
    (input.version === 1 || input.version === 2);
  if (legacy) {
    const value = input as Record<string, unknown>;
    if (value.version === 1) {
      const v1 = oldShape
        .extend({
          version: z.literal(1),
          battle: battle
            .unwrap()
            .omit({ mana: true })
            .extend({ energy: z.number().int().min(0).max(3) })
            .nullable(),
        })
        .parse(value);
      input = {
        ...v1,
        version: 2,
        battle: v1.battle ? (({ energy, ...b }) => ({ ...b, mana: energy }))(v1.battle) : null,
      };
    }
    const old = oldShape.parse(input);
    input = {
      ...createGame(old.rng),
      ...old,
      version: 3,
      roster: old.team.map((c) => c.species),
      reward:
        old.phase === "reward"
          ? {
              xp: {},
              currency: 0,
              outcome: "next",
              recruits: [...new Set(old.battle!.enemies.map((e) => e.species))].filter(
                (kind) => !old.team.some((c) => c.species === kind),
              ),
              relics: [],
            }
          : null,
    };
  }
  if (input && typeof input === "object" && "version" in input && input.version === 3) {
    const old = shape.parse(input);
    if (!unique(old.roster) || old.team.some((c) => !old.roster.includes(c.species)))
      throw new Error("Legacy save contains an inconsistent roster.");
    const roster = [
      ...old.team.map((c) => c.species),
      ...old.roster.filter((kind) => !old.team.some((c) => c.species === kind)),
    ].slice(0, 5);
    const zones = old.battle ? [...old.battle.hand, ...old.battle.draw, ...old.battle.discard] : [];
    if (old.battle)
      old.battle.discard.push(
        ...old.cards
          .filter((c) => !zones.includes(c.id) && old.team.some((t) => t.id === c.ownerId && t.health === 0))
          .map((c) => c.id),
      );
    input = {
      ...old,
      version: 4,
      roster,
      lineup: old.team.map((c) => c.species),
      reserves: roster
        .filter((kind) => !old.team.some((c) => c.species === kind))
        .map((kind) => ({
          id: `recruit-${kind}`,
          species: kind,
          health: old.reward?.outcome === "defeat" ? 0 : species(kind).health,
          block: 0,
          attacked: false,
        })),
    };
  }
  const s = currentShape.parse(input);
  const invalid = (condition: boolean) => {
    if (condition) throw new Error("Save contains inconsistent game data.");
  };
  invalid(
    !unique(s.unlocked) ||
      !unique(s.selected) ||
      !unique(s.roster) ||
      INITIAL_SPECIES.some((kind) => !s.unlocked.includes(kind)) ||
      s.selected.some((kind) => !s.unlocked.includes(kind)) ||
      s.roster.some((kind) => !s.unlocked.includes(kind)) ||
      s.wins > 0 !== s.unlocked.includes("moonhart"),
  );
  invalid(
    !unique([...s.team, ...s.reserves].map((c) => c.id)) ||
      !unique([...s.team, ...s.reserves].map((c) => c.species)) ||
      !unique(s.lineup) ||
      s.lineup.some((kind) => !s.roster.includes(kind)) ||
      !unique(s.cards.map((c) => c.id)) ||
      !unique(s.talents) ||
      !unique(s.relics),
  );
  invalid(
    [...s.team, ...s.reserves].some(
      (c) => !s.roster.includes(c.species) || c.health > species(c.species).health,
    ) || s.roster.length !== s.team.length + s.reserves.length,
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
  // Older unfinished drafts retain their first choice; committed expeditions keep their full team.
  if (s.phase === "draft") s.selected = s.selected.slice(0, 1);
  if (s.phase === "teamSelection")
    invalid(
      s.battle !== null || s.reward !== null || s.team.some((c, index) => c.species !== s.lineup[index]),
    );
  if (["battle", "reward", "recruit", "relic"].includes(s.phase)) invalid(!s.battle);
  const rewardPhase = ["reward", "recruit", "relic"].includes(s.phase);
  invalid(rewardPhase && !s.reward);
  invalid(!rewardPhase && s.reward !== null && !["victory", "defeat"].includes(s.phase));
  if (s.phase !== "battle") invalid(Object.values(s.battleXP).some((n) => n !== 0));
  if (s.reward) {
    invalid(
      !unique(s.reward.recruits) ||
        !unique(s.reward.relics) ||
        s.reward.recruits.some((kind) => !ENCOUNTERS[s.encounter]!.enemies.some((e) => e.species === kind)),
    );
    invalid(
      (s.reward.outcome === "next" && s.encounter === 2) ||
        (s.reward.outcome === "victory" && s.encounter !== 2),
    );
    if (s.phase === "recruit") invalid(s.reward.recruits.length === 0 || s.reward.outcome === "defeat");
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
      source = ENCOUNTERS[s.encounter]!;
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
    const zones = [...b.draw, ...b.hand, ...b.discard];
    invalid(!unique(zones) || zones.some((id) => !s.cards.some((c) => c.id === id)));
    if (s.phase === "battle") {
      const liveCards = s.cards;
      invalid(
        (!legacy && b.mana === 0) ||
          ![...s.team, ...s.reserves].some((c) => c.health > 0) ||
          !b.enemies.some((e) => e.health > 0) ||
          zones.length !== liveCards.length ||
          liveCards.some((c) => !zones.includes(c.id)),
      );
    }
  }
  invalid(
    s.phase === "victory" &&
      (s.encounter !== 2 || s.wins === 0 || !s.battle || s.battle.enemies.some((e) => e.health > 0)),
  );
  const state = freeze(s, true) as GameState;
  return legacy && state.phase === "battle" && state.battle!.mana === 0
    ? dispatch(state, { type: "endTurn" }).state
    : state;
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
