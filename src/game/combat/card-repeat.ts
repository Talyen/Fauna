import { emitSupport } from "../events";
import type { BattleState, GameEvent } from "../types";

/** Spend before resolution so a repeated Dancing Double refreshes one future card. */
export function takeCardRepeat(state: BattleState, side: "player" | "enemy") {
  const repeat = state.battle.repeatNext[side];
  state.battle.repeatNext[side] = false;
  return repeat;
}

export function grantCardRepeat(
  state: BattleState,
  side: "player" | "enemy",
  actorId: string,
  events: GameEvent[],
) {
  state.battle.repeatNext[side] = true;
  emitSupport(events, actorId, {
    text: side === "player" ? "Your next card is played twice" : "The enemy's next card is played twice",
  });
}
