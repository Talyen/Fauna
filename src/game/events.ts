import type { GameEvent, StatusEvent } from "./types";

/** Preserve event shape and order while callers own the committed facts and emission point. */
export function emitStatus(
  events: GameEvent[],
  targetId: string,
  status: StatusEvent["status"],
  outcome: StatusEvent["outcome"],
  details: Omit<StatusEvent, "kind" | "targetId" | "status" | "outcome">,
) {
  events.push({ kind: "status", targetId, status, outcome, ...details });
}
export function emitSupport(
  events: GameEvent[],
  actorId: string,
  details: Omit<Extract<GameEvent, { kind: "action" }>, "kind" | "actionType" | "actorId">,
) {
  events.push({ kind: "action", actionType: "support", actorId, ...details });
}
