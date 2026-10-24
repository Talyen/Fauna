import { boonRule, PLAYER_CARD_TRIGGER_LIMIT } from "../rules/boons";
import { gainMana } from "./index";
import { livingChorus } from "./turns";
import type { BattleState, GameEvent } from "../types";

/** One accepted player card owns this counter, before refill and settlement. */
export function afterPlayerCard(state: BattleState, events: GameEvent[]) {
  const battle = state.battle;
  if (battle.cardsPlayedThisTurn < PLAYER_CARD_TRIGGER_LIMIT) {
    battle.cardsPlayedThisTurn++;
    if (battle.cardsPlayedThisTurn === 2) livingChorus(state, false, events);
    if (
      battle.cardsPlayedThisTurn === boonRule("resonant-chimes").cards &&
      state.boons.includes("resonant-chimes")
    )
      gainMana(state, boonRule("resonant-chimes").mana, events);
  }
}
