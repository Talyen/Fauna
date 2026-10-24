import { boonRule, PLAYER_CARD_TRIGGER_LIMIT } from "../rules/boons";
import { talentRule } from "../rules/talents";
import { gainMana, ensureCombat, type Combatant } from "./index";
import type { ProgressionKeyword } from "../keywords";
import { livingChorus } from "./turns";
import type { BattleState, GameEvent } from "../types";

/** Spend already granted effects without rechecking whether the granting Talent is selected. */
export function consumeCardGrants(actor: Combatant, keywords: readonly ProgressionKeyword[]) {
  ensureCombat(actor)[talentRule("stun.free-follow-up").state] = false;
  if (keywords.includes("nature")) ensureCombat(actor)[talentRule("nature.windstep").state] = false;
  if (keywords.includes("light")) ensureCombat(actor)[talentRule("light.divine-favor").state] = false;
}

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
