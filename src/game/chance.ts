import { battlefield } from "./battlefield";
import { creaturePassive } from "./progression";
import { roll } from "./random";
import type { GameEvent, GameState } from "./types";

/** A favorable chance, never a random selection; one gate can admit one original-probability retry. */
export function chance(
  state: GameState,
  probability: number,
  enemy: boolean,
  events: GameEvent[],
  above = false,
): boolean {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  const succeeds = () =>
    above
      ? roll(state, { kind: "chance", threshold: 1 - probability }) >= 1 - probability
      : roll(state, { kind: "chance", threshold: probability }) < probability;
  if (succeeds()) return true;
  if (state.phase !== "battle" || !state.battle) return false;
  // The strongest living deployed provider owns the gate; providers never retry each other's gates.
  let provider;
  let percent = 0;
  for (const unit of battlefield(state, enemy ? "enemy" : "player")) {
    if (unit.health <= 0) continue;
    const amount = creaturePassive(enemy ? undefined : state, unit.species).effects.reduce(
      (total, effect) => total + (effect.kind === "goodFortune" ? effect.amount : 0),
      0,
    );
    if (amount > percent) {
      percent = amount;
      provider = unit;
    }
  }
  if (!provider || roll(state, { kind: "chance", threshold: percent / 100 }) >= percent / 100 || !succeeds())
    return false;
  events.push({
    kind: "action",
    actionType: "support",
    actorId: provider.id,
    text: "Good Fortune turns the odds",
  });
  return true;
}
