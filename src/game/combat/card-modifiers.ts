import { boonRule, PLAYER_CARD_TRIGGER_LIMIT } from "../rules/boons";
import { talentRule } from "../rules/talents";
import { gainMana, ensureCombat, type Combatant } from "./index";
import type { ProgressionKeyword } from "../keywords";
import { livingChorus } from "./turns";
import type { BattleState, GameEvent, Card } from "../types";
import { definition } from "../content";
import { battlefield } from "../battlefield";
import { receiveCard } from "../card-zones";

/** Reuse the played slot; no copies, free plays or extra accepted-play counts. */
export function returnDodgedCard(state: BattleState, card: Card, events: GameEvent[], start: number) {
  if (
    !state.boons.includes("dream-yo-yo") ||
    definition(card.definitionId).consume ||
    !state.cards.some((entry) => entry.id === card.id) ||
    !state.team.some((ally) => ally.id === card.ownerId && ally.health > 0)
  )
    return;
  const enemies = new Set(battlefield(state, "enemy").map((enemy) => enemy.id));
  if (
    !events
      .slice(start)
      .some((event) => event.kind === "status" && event.outcome === "dodge" && enemies.has(event.targetId))
  )
    return;
  const index = state.battle.discard.indexOf(card.id);
  if (index < 0) return;
  state.battle.discard.splice(index, 1);
  receiveCard(state, card.id);
  events.push({
    kind: "action",
    actionType: "support",
    actorId: card.ownerId ?? undefined,
    text: `${definition(card.definitionId).name} returns to hand`,
  });
}

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
