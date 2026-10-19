import { freeze } from "immer";
import { dispatch } from "./engine";
import { z } from "zod";
import { CARDS, ENCOUNTERS, INITIAL_SPECIES, SPECIES, species } from "./content";
import type { GameState } from "./types";
const natural = z.number().int().min(0).max(1_000_000);
const id = z.string().min(1).max(120);
const speciesId = z.enum(["mossback", "emberfox", "stormfin", "silkmoth", "briartooth", "moonhart"]);
const shape = z.object({
  version: z.literal(2),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
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
  battle: z
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
    .nullable(),
});
const legacyShape = shape.extend({
  version: z.literal(1),
  battle: shape.shape.battle
    .unwrap()
    .omit({ mana: true })
    .extend({ energy: z.number().int().min(0).max(3) })
    .nullable(),
});

function unique(values: unknown[]) {
  return new Set(values).size === values.length;
}
export function decodeSave(raw: string): GameState {
  if (raw.length > 100_000) throw new Error("Save exceeds the supported size.");
  const input: unknown = JSON.parse(raw);
  const legacy = legacyShape.safeParse(input);
  const converted = legacy.success
    ? {
        ...legacy.data,
        version: 2,
        battle: legacy.data.battle
          ? (({ energy, ...battle }) => ({ ...battle, mana: energy }))(legacy.data.battle)
          : null,
      }
    : input;
  const s = shape.parse(converted);
  const invalid = (condition: boolean) => {
    if (condition) throw new Error("Save contains inconsistent game data.");
  };
  invalid(
    !unique(s.unlocked) ||
      !unique(s.selected) ||
      INITIAL_SPECIES.some((id) => !s.unlocked.includes(id)) ||
      s.selected.some((id) => !s.unlocked.includes(id)) ||
      s.wins > 0 !== s.unlocked.includes("moonhart"),
  );
  invalid(
    !unique(s.team.map((c) => c.id)) ||
      !unique(s.team.map((c) => c.species)) ||
      !unique(s.cards.map((c) => c.id)),
  );
  invalid(s.team.some((c) => !s.unlocked.includes(c.species) || c.health > species(c.species).health));
  invalid(
    s.cards.some(
      (c) =>
        !s.team.some(
          (t) => t.id === c.ownerId && CARDS.some((d) => d.id === c.definitionId && d.species === t.species),
        ),
    ),
  );
  for (const c of s.team) {
    const expected = CARDS.filter((d) => d.species === c.species);
    invalid(
      expected.some(
        (d) => s.cards.filter((card) => card.ownerId === c.id && card.definitionId === d.id).length !== 1,
      ),
    );
  }
  if (s.phase === "draft") invalid(s.team.length !== 0 || s.cards.length !== 0 || s.battle !== null);
  else invalid(s.team.length !== 3 || s.cards.length !== 9 || !s.battle);
  if (s.battle) {
    const b = s.battle;
    invalid(!legacy.success && s.phase === "battle" && b.mana === 0);
    const encounter = ENCOUNTERS[s.encounter]!;
    invalid(b.enemies.length !== encounter.enemies.length || !unique(b.enemies.map((e) => e.id)));
    b.enemies.forEach((e, i) => {
      const source = encounter.enemies[i];
      invalid(
        !source ||
          e.id !== `enemy-${i}` ||
          e.species !== source.species ||
          e.maxHealth !== source.health ||
          e.damage !== source.damage ||
          e.health > e.maxHealth ||
          !s.team.some((c) => c.id === e.targetId),
      );
    });
    const zones = [...b.draw, ...b.hand, ...b.discard];
    invalid(!unique(zones) || zones.some((id) => !s.cards.some((c) => c.id === id)));
    if (s.phase === "battle") {
      const liveCards = s.cards.filter((c) => s.team.some((t) => t.id === c.ownerId && t.health > 0));
      invalid(
        !s.team.some((c) => c.health > 0) ||
          !b.enemies.some((e) => e.health > 0) ||
          zones.length !== liveCards.length ||
          liveCards.some((c) => !zones.includes(c.id)),
      );
    }
    if (s.phase === "reward" || s.phase === "victory") invalid(b.enemies.some((e) => e.health > 0));
  }
  invalid((s.phase === "reward" && s.encounter === 2) || (s.phase === "victory" && s.encounter !== 2));
  const frozen = freeze(s, true) as GameState;
  if (legacy.success && frozen.phase === "battle" && frozen.battle!.mana === 0)
    return dispatch(frozen, { type: "endTurn" }).state;
  return frozen;
}
export function encodeSave(state: GameState): string {
  return JSON.stringify(state);
}
export function validateContent() {
  if (!unique(SPECIES.map((s) => s.id)) || !unique(CARDS.map((c) => c.id)))
    throw new Error("Duplicate content IDs.");
  for (const s of SPECIES) {
    if (CARDS.filter((c) => c.species === s.id).length !== 3)
      throw new Error(`${s.name} must contribute three cards.`);
  }
}
