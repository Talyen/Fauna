import { boonRule, PLAYER_CARD_TRIGGER_LIMIT } from "../rules/boons";
import { talentRule } from "../rules/talents";
import { gainMana, ensureCombat, restoreHealth, mostInjured, type Combatant } from "./index";
import type { ProgressionKeyword } from "../keywords";
import { livingChorus } from "./turns";
import type { BattleState, GameEvent, Card } from "../types";
import { definition } from "../content";
import { battlefield, healingAllies } from "../battlefield";
import { creaturePassive } from "../progression";
import { receiveCard, draw } from "../card-zones";

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

/** The command snapshots the last-card condition before effects, draws and repeats. */
export function lastWarmth(state: BattleState, enemy: boolean, events: GameEvent[]) {
  const side = enemy ? "enemy" : "player";
  for (const source of battlefield(state, side)) {
    if (source.health <= 0) continue;
    const amount = creaturePassive(enemy ? undefined : state, source.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "lastWarmth" ? effect.amount : 0),
      0,
    );
    const recipient = amount > 0 ? mostInjured(healingAllies(state, side)) : undefined;
    if (recipient) restoreHealth(recipient, amount, events, false, state, false, source);
  }
}

/** One accepted player card owns this counter, before refill and settlement. */
export function afterPlayerCard(state: BattleState, events: GameEvent[]) {
  const battle = state.battle;
  if (state.boons.includes("encore-baton")) {
    battle.encoreProgress++;
    if (battle.encoreProgress === boonRule("encore-baton").cards) {
      battle.encoreProgress = 0;
      draw(state, boonRule("encore-baton").draw, events);
    }
  }
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
