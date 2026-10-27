import { battlefield, battlefieldView } from "../../game/battlefield";
import { sharedDodgeChance } from "../../game/combat/index";
import { maximumHealth, unitName } from "../../game/combat/state";
import { isKeywordId, KEYWORD_DEFINITIONS } from "../../game/keywords";
import type { CommandResult, GameEvent, GameState } from "../../game/types";
import { combatStatuses, type Status } from "../shared/combat/combat-status-model";
import type { PlayProjection } from "../../game/preview";

export interface TargetForecast {
  readonly alternatives?: readonly TargetForecast[];
  readonly unresolved?: boolean;
  readonly name: string;
  readonly health: number;
  readonly previousHealth: number;
  readonly block: number;
  readonly previousBlock: number;
  readonly maxHealth: number;
  readonly absorbed: number;
  readonly changes: readonly StatusChange[];
  readonly events: readonly GameEvent[];
}
export interface StatusChange {
  readonly id: string;
  readonly prior?: Status;
  readonly now?: Status;
}

function englishStatusChange(change: StatusChange) {
  if (isKeywordId(change.id))
    return `${KEYWORD_DEFINITIONS[change.id].label} ${change.prior?.count ?? 0} → ${change.now?.count ?? 0}`;
  return change.now?.text ?? `Remove ${change.prior!.text}`;
}
export interface PlayPreviewModel {
  readonly messages: readonly string[];
  readonly affected: ReadonlySet<string>;
  readonly units: ReadonlyMap<string, TargetForecast>;
}

function baselineUnits(before: GameState) {
  return [...battlefieldView(before, "player"), ...battlefieldView(before, "enemy"), ...before.reserves].map(
    (old) => ({
      old,
      statuses: combatStatuses(old.combat, sharedDodgeChance(before, old)),
      name: unitName(old),
      maxHealth: maximumHealth(old),
    }),
  );
}

/** One projection supplies both highlights and per-recipient readouts from authoritative output. */
function resolvedPreviewModel(
  before: GameState,
  result: CommandResult | null,
  targetId?: string,
  baseline = () => baselineUnits(before),
): PlayPreviewModel {
  const affected = new Set<string>();
  const units = new Map<string, TargetForecast>();
  if (!result?.accepted) {
    for (const event of result?.events ?? []) if (event.targetId) affected.add(event.targetId);
    if (targetId) affected.add(targetId);
    return { affected, units, messages: [] };
  }
  const nextUnits = new Map<string, ReturnType<typeof battlefield>[number]>();
  for (const row of [
    battlefieldView(result.state, "player"),
    battlefieldView(result.state, "enemy"),
    result.state.reserves,
  ])
    for (const unit of row) nextUnits.set(unit.id, unit);
  const grouped = new Map<string, { events: GameEvent[]; absorbed: number }>();
  const messages: string[] = [];
  for (const event of result.events) {
    if (!event.targetId) {
      if (event.kind === "status") messages.push(event.text);
      continue;
    }
    affected.add(event.targetId);
    const group = grouped.get(event.targetId) ?? { events: [], absorbed: 0 };
    group.events.push(event);
    if (event.kind === "block" && event.amount < 0) group.absorbed += event.amount;
    grouped.set(event.targetId, group);
  }
  if (targetId) affected.add(targetId);
  for (const { old, statuses: previous, name, maxHealth } of baseline()) {
    const next = nextUnits.get(old.id) ?? { ...old, health: 0, block: 0 };
    const current = combatStatuses(next.combat, sharedDodgeChance(result.state, next));
    const statusesChanged =
      previous.length !== current.length ||
      previous.some((status, index) => {
        const other = current[index];
        return !other || status.id !== other.id || status.text !== other.text || status.count !== other.count;
      });
    if (old.health !== next.health || old.block !== next.block || statusesChanged) affected.add(old.id);
    const changes = !statusesChanged
      ? []
      : [...new Set([...previous, ...current].map((status) => status.id))].flatMap((id) => {
          const prior = previous.find((status) => status.id === id),
            now = current.find((status) => status.id === id);
          if (prior?.text === now?.text) return [];
          return [{ id, prior, now }];
        });
    const group = grouped.get(old.id);
    units.set(old.id, {
      name,
      health: next.health,
      previousHealth: old.health,
      block: next.block,
      previousBlock: old.block,
      maxHealth,
      absorbed: -(group?.absorbed ?? 0),
      changes,
      events: group?.events ?? [],
    });
  }
  return {
    affected,
    units,
    messages,
  };
}

export function playPreviewModel(
  before: GameState,
  result: CommandResult | PlayProjection | null,
  targetId?: string,
): PlayPreviewModel {
  if (!result || "accepted" in result) return resolvedPreviewModel(before, result, targetId);
  if (result.kind === "unknown") {
    const model = resolvedPreviewModel(before, { accepted: true, state: before, events: [] }, targetId);
    if (!targetId || !model.units.has(targetId)) return model;
    const units = new Map(model.units);
    units.set(targetId, { ...units.get(targetId)!, unresolved: true });
    return { ...model, units };
  }
  let baseline: ReturnType<typeof baselineUnits> | undefined;
  const worlds = result.outcomes.map((outcome) =>
    resolvedPreviewModel(before, outcome, targetId, () => (baseline ??= baselineUnits(before))),
  );
  const affected = new Set<string>();
  for (const world of worlds) for (const id of world.affected) affected.add(id);
  const units = new Map<string, TargetForecast>();
  for (const id of affected) {
    if (worlds.length === 1) {
      const value = worlds[0]!.units.get(id);
      if (value) units.set(id, value);
      continue;
    }
    const possibilities = new Map<string, TargetForecast>();
    for (const world of worlds) {
      const value = world.units.get(id);
      if (!value) continue;
      possibilities.set(JSON.stringify({ ...value, changes: value.changes.map(englishStatusChange) }), value);
    }
    // Keep complete per-recipient outcomes together; never synthesize a world from independent extrema.
    const distinct = [...possibilities.values()];
    const first = distinct[0];
    if (first) units.set(id, distinct.length === 1 ? first : { ...first, alternatives: distinct });
  }
  const messages =
    worlds.length === 1
      ? worlds[0]!.messages
      : (worlds[0]?.messages.filter((message) => worlds.every((world) => world.messages.includes(message))) ??
        []);
  return { affected, units, messages };
}
