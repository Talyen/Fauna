import { battlefield } from "../../game/battlefield";
import { sharedDodgeChance } from "../../game/combat/index";
import { maximumHealth, unitName } from "../../game/combat/state";
import { KEYWORD_DEFINITIONS } from "../../game/keywords";
import type { CommandResult, GameEvent, GameState } from "../../game/types";
import { combatStatuses } from "../shared/combat/combat-status";

export interface TargetForecast {
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
  readonly affected: ReadonlySet<string>;
  readonly units: ReadonlyMap<string, TargetForecast>;
}

/** One projection supplies both highlights and per-recipient readouts from authoritative output. */
export function playPreviewModel(
  before: GameState,
  result: CommandResult | null,
  targetId?: string,
): PlayPreviewModel {
  const affected = new Set(result?.events.flatMap((event) => (event.targetId ? [event.targetId] : [])) ?? []);
  if (targetId) affected.add(targetId);
  const units = new Map<string, TargetForecast>();
  if (!result?.accepted) return { affected, units };
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
    const next = nextUnits.get(old.id);
    if (!next) continue;
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
  return { affected, units };
}
