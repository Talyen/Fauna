import { emitSupport } from "./events";
import { talentRule, type TalentRuleId } from "./rules/talents";
import { battlefieldView } from "./battlefield";
import { hasTalent, passiveAmount } from "./progression";
import { roll } from "./random";
import type { GameEvent, GameState } from "./types";

function succeeds(state: GameState, probability: number, above: boolean) {
  return above
    ? roll(state, { kind: "chance", threshold: 1 - probability }) >= 1 - probability
    : roll(state, { kind: "chance", threshold: probability }) < probability;
}

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
  if (succeeds(state, probability, above)) return true;
  if (state.phase !== "battle" || !state.battle) return false;
  // The strongest living deployed provider owns the gate; providers never retry each other's gates.
  let provider;
  let percent = 0;
  for (const unit of battlefieldView(state, enemy ? "enemy" : "player")) {
    if (unit.health <= 0) continue;
    const amount = passiveAmount(enemy ? undefined : state, unit.species, "goodFortune");
    if (amount > percent) {
      percent = amount;
      provider = unit;
    }
  }
  if (
    !provider ||
    roll(state, { kind: "chance", threshold: percent / 100 }) >= percent / 100 ||
    !succeeds(state, probability, above)
  )
    return false;
  emitSupport(events, provider.id, { text: "Good Fortune turns the odds" });
  return true;
}

type PercentTalentId = {
  [Id in TalentRuleId]: ReturnType<typeof talentRule<Id>> extends { percent: number } ? Id : never;
}[TalentRuleId];

/** Unowned Talents never consume RNG; the caller retains its effect and liveness guards. */
export function talentChance(state: GameState, id: PercentTalentId, events: GameEvent[]): boolean {
  return hasTalent(state, id) && chance(state, talentRule(id).percent / 100, false, events);
}
