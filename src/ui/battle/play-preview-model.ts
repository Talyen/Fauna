import { battlefield } from "../../game/battlefield";
import { sharedDodgeChance } from "../../game/combat/index";
import { maximumHealth, unitName } from "../../game/combat/state";
import { KEYWORD_DEFINITIONS } from "../../game/keywords";
import type { CommandResult, GameEvent, GameState } from "../../game/types";
import { combatStatuses } from "../shared/combat/combat-status";
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
  readonly changes: readonly string[];
  readonly events: readonly GameEvent[];
}
export interface PlayPreviewModel {
  readonly messages: readonly string[];
  readonly affected: ReadonlySet<string>;
  readonly units: ReadonlyMap<string, TargetForecast>;
}

/** One projection supplies both highlights and per-recipient readouts from authoritative output. */
function resolvedPreviewModel(
  before: GameState,
  result: CommandResult | null,
  targetId?: string,
): PlayPreviewModel {
  const affected = new Set(result?.events.flatMap((event) => (event.targetId ? [event.targetId] : [])) ?? []);
  if (targetId) affected.add(targetId);
  const units = new Map<string, TargetForecast>();
  if (!result?.accepted) return { affected, units, messages: [] };
  const nextUnits = new Map(
    [
      ...battlefield(result.state, "player"),
      ...battlefield(result.state, "enemy"),
      ...result.state.reserves,
    ].map((unit) => [unit.id, unit]),
  );
  const grouped = new Map<string, GameEvent[]>();
  for (const event of result.events) {
    if (!event.targetId) continue;
    const events = grouped.get(event.targetId) ?? [];
    events.push(event);
    grouped.set(event.targetId, events);
  }
  for (const old of [...battlefield(before, "player"), ...battlefield(before, "enemy"), ...before.reserves]) {
    const next = nextUnits.get(old.id) ?? { ...old, health: 0, block: 0 };
    const previous = combatStatuses(old.combat, sharedDodgeChance(before, old));
    const current = combatStatuses(next.combat, sharedDodgeChance(result.state, next));
    const statusesChanged =
      previous.length !== current.length ||
      previous.some((status, index) => {
        const other = current[index];
        return !other || status.id !== other.id || status.text !== other.text || status.count !== other.count;
      });
    if (old.health !== next.health || old.block !== next.block || statusesChanged) affected.add(old.id);
    const changes = [...new Set([...previous, ...current].map((status) => status.id))].flatMap((id) => {
      const prior = previous.find((status) => status.id === id),
        now = current.find((status) => status.id === id);
      if (prior?.text === now?.text) return [];
      const keyword = Object.hasOwn(KEYWORD_DEFINITIONS, id)
        ? KEYWORD_DEFINITIONS[id as keyof typeof KEYWORD_DEFINITIONS].label
        : undefined;
      return [
        keyword
          ? `${keyword} ${prior?.count ?? 0} → ${now?.count ?? 0}`
          : (now?.text ?? `Remove ${prior!.text}`),
      ];
    });
    const events = grouped.get(old.id) ?? [];
    const absorbed = -events
      .filter(
        (event): event is Extract<GameEvent, { kind: "block" }> => event.kind === "block" && event.amount < 0,
      )
      .reduce((sum, event) => sum + event.amount, 0);
    units.set(old.id, {
      name: unitName(old),
      health: next.health,
      previousHealth: old.health,
      block: next.block,
      previousBlock: old.block,
      maxHealth: maximumHealth(old),
      absorbed,
      changes,
      events,
    });
  }
  return {
    affected,
    units,
    messages: result.events
      .filter((event) => event.kind === "status" && !event.targetId)
      .map((event) => event.text),
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
    if (targetId && model.units.has(targetId))
      model.units.set(targetId, { ...model.units.get(targetId)!, unresolved: true });
    return model;
  }
  const worlds = result.outcomes.map((outcome) => resolvedPreviewModel(before, outcome, targetId));
  const affected = new Set(worlds.flatMap((world) => [...world.affected]));
  const units = new Map<string, TargetForecast>();
  for (const id of affected) {
    const possibilities = worlds.flatMap((world) => (world.units.has(id) ? [world.units.get(id)!] : []));
    // Keep complete per-recipient outcomes together; never synthesize a world from independent extrema.
    const distinct = [...new Map(possibilities.map((value) => [JSON.stringify(value), value])).values()];
    const first = distinct[0];
    if (first) units.set(id, distinct.length === 1 ? first : { ...first, alternatives: distinct });
  }
  const messages =
    worlds[0]?.messages.filter((message) => worlds.every((world) => world.messages.includes(message))) ?? [];
  return { affected, units, messages };
}
