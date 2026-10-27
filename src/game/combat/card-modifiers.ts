import { boonRule, PLAYER_CARD_TRIGGER_LIMIT } from "../rules/boons";
import { talentRule } from "../rules/talents";
import {
  gainMana,
  ensureCombat,
  restoreHealth,
  mostInjured,
  triggerArmorBreak,
  type Combatant,
} from "./index";
import { resolveCombat } from "./resolution";
import type { ProgressionKeyword } from "../keywords";
import { livingChorus } from "./turns";
import type { BattleState, GameEvent, Card } from "../types";
import { definition } from "../content";
import { battlefield, healingAllies } from "../battlefield";
import { passiveAmount } from "../progression";
import { receiveCard, draw, journeyReturn } from "../card-zones";

/** Reuse the played slot; no copies, free plays or extra accepted-play counts. */
export function returnDodgedCard(state: BattleState, card: Card, events: GameEvent[], start: number) {
  if (!state.boons.includes("dream-yo-yo")) return;
  const def = definition(card.definitionId);
  if (def.consume) return;
  // A summoner may fall after its Echo Dodges during the same card. The retained
  // Echo receipt still identifies that opponent after it leaves the battlefield.
  let enemies: Set<string> | undefined;
  let dodged = false;
  for (let index = start; index < events.length; index++) {
    const event = events[index]!;
    if (event.kind !== "status" || event.outcome !== "dodge") continue;
    if (!enemies) {
      enemies = new Set();
      for (const enemy of state.battle.enemies) enemies.add(enemy.id);
      if (state.battle.minions)
        for (const unit of state.battle.minions) if (unit.minion.side === "enemy") enemies.add(unit.id);
    }
    if (enemies.has(event.targetId)) {
      dodged = true;
      break;
    }
  }
  if (!dodged) return;
  const index = state.battle.discard.indexOf(card.id);
  if (index < 0 || !state.cards.some((entry) => entry.id === card.id)) return;
  const owner = state.team.find((ally) => ally.id === card.ownerId);
  if (!owner) return;
  state.battle.discard.splice(index, 1);
  receiveCard(state, card.id);
  journeyReturn(state, card.ownerId, events);
  events.push({
    kind: "action",
    actionType: "support",
    actorId: owner.id,
    text: `${def.name} returns to hand`,
  });
}

/** Spend already granted effects without rechecking whether the granting Talent is selected. */
export function consumeCardGrants(actor: Combatant, keywords: readonly ProgressionKeyword[]) {
  const stats = ensureCombat(actor);
  stats[talentRule("stun.free-follow-up").state] = false;
  if (keywords.includes("nature")) stats[talentRule("nature.windstep").state] = false;
  if (keywords.includes("light")) stats[talentRule("light.divine-favor").state] = false;
}

/** The command snapshots the last-card condition before effects, draws and repeats. */
export function lastWarmth(state: BattleState, enemy: boolean, events: GameEvent[]) {
  const side = enemy ? "enemy" : "player";
  for (const source of battlefield(state, side)) {
    if (source.health <= 0) continue;
    const amount = passiveAmount(enemy ? undefined : state, source.species, "lastWarmth");
    const recipient = amount > 0 ? mostInjured(healingAllies(state, side)) : undefined;
    if (recipient) restoreHealth(recipient, amount, events, false, state, false, source);
  }
}

/** One accepted player card owns this counter, before refill and settlement. */
export function afterPlayerCard(state: BattleState, events: GameEvent[], actor?: Combatant) {
  const battle = state.battle;
  if (actor && state.boons.includes("mercury-metronome")) {
    const previous = battle.metronomeActor;
    battle.metronomeActor = actor.id;
    if (previous !== null && previous !== actor.id && actor.health > 0) {
      for (const enemy of battlefield(state, "enemy")) {
        if (actor.health <= 0) break;
        if (enemy.health <= 0) continue;
        const result = resolveCombat(
          "applyHarmfulStatus",
          state,
          actor,
          enemy,
          boonRule("mercury-metronome").buildup,
          "stun",
          events,
        );
        if (result.appliedControl) resolveCombat("controlRewards", state, actor, enemy, "stun", events);
        for (const depletion of result.depletions) triggerArmorBreak(state, depletion, events);
      }
    }
  }
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
      state.boons.includes("resonant-chimes") &&
      battle.cardsPlayedThisTurn === boonRule("resonant-chimes").cards
    )
      gainMana(state, boonRule("resonant-chimes").mana, events);
  }
}
