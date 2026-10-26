import { MAX_BATTLE_TURN } from "../state-limits";
import { boonRule } from "../rules/boons";
import { battleMana, renewalManaBonus } from "./battle-modifiers";
import { cardActor, unfinishedJourneyLimit } from "../card-actors";
import { battlefield, isEnemy, healingAllies } from "../battlefield";
import { definition, speciesCards, SPECIES } from "../content";
import { drawBossCards, removeDepartedMinions } from "./legendary";
import { chooseEnemyCard } from "./enemy-policy";
import { lastWarmth } from "./card-modifiers";
import { recycleDiscard, MAX_BATTLE_CARDS, MAX_HAND_SIZE } from "../card-zones";
import { playEnemyAbility } from "./enemy-action";
import { passiveAmount } from "../progression";
import {
  ensureCombat,
  gainMana,
  restoreHealth,
  mostInjured,
  startAction,
  grantStatus,
  grantArmor,
  tickStatuses,
  controlled,
  TURN_MANA,
  TURN_DRAW,
  type Combatant,
} from "./index";
import { draw, expressDelivery } from "../card-zones";
import { retainedBlock } from "../ability-rules";
import { enemyCard, enemyCanUse } from "../card-rules";
import type { GameEvent, GameState, BattleState } from "../types";
import { living, pendingReplacement } from "../team";
import { settle, intents } from "../journey";

// Adapt immutable authored kits once for both value estimation and execution.
const enemyAbilities = new Map(
  SPECIES.map(({ id }) => [id, speciesCards(id).filter(enemyCanUse).map(enemyCard)]),
);

/** Convert only Block lost to ordinary turn decay, using the owner's passive tier. */
export function decayBlock(state: GameState, unit: Combatant, events: GameEvent[]) {
  const before = unit.block;
  const allied = !isEnemy(unit);
  const retained = retainedBlock(unit, allied ? state : undefined);
  unit.block =
    allied && state.boons.includes("geode-anvil")
      ? Math.max(retained, Math.min(before, ensureCombat(unit).armor))
      : retained;
  const lost = before - unit.block;
  if (lost <= 0 || unit.health <= 0) return;
  const percent = passiveAmount(allied ? state : undefined, unit.species, "fallenLeaves");
  if (percent > 0) grantStatus(unit, "thorns", Math.round((lost * percent) / 100), events, state);
  if (allied && state.boons.includes("pleated-pagoda"))
    grantArmor(state, unit, Math.round(lost / boonRule("pleated-pagoda").divisor), events);
}

export function livingChorus(state: GameState, enemy: boolean, events: GameEvent[]) {
  const row = enemy ? state.battle!.enemies : state.team;
  for (const singer of row) {
    if (singer.health <= 0) continue;
    const amount = passiveAmount(enemy ? undefined : state, singer.species, "livingChorus");
    const recipient =
      amount > 0
        ? mostInjured<import("../combat/index").Combatant>(healingAllies(state, enemy ? "enemy" : "player"))
        : undefined;
    if (recipient) restoreHealth(recipient, amount, events, false, state, false, singer);
  }
}
export function unhurried(state: BattleState, enemy: boolean, events: GameEvent[]) {
  const row = battlefield(state, enemy ? "enemy" : "player").filter((unit) => unit.health > 0);
  for (const dreamer of row) {
    const amount = passiveAmount(enemy ? undefined : state, dreamer.species, "unhurried");
    if (amount <= 0) continue;
    for (const recipient of healingAllies(state, enemy ? "enemy" : "player"))
      if (ensureCombat(recipient).cardsPlayedThisTurn === 0)
        restoreHealth(recipient, amount, events, false, state, false, dreamer);
  }
}
export function finishTurn(draft: BattleState, events: GameEvent[]) {
  const battle = draft.battle;
  // Enemy-phase draws and existing overflow survive into the next player turn.
  battle.discard.push(...battle.hand.splice(0));
  recycleDiscard(draft);
  for (let pass = 0; pass < 3; pass++) {
    const bonusMana = renewalManaBonus(draft);
    unhurried(draft, false, events);
    // Swaps can reorder the battlefield; each enemy keeps its single action window.
    const actionOrder = battle.enemies.slice();
    // Expire the previous round before an ally can grant Dodge for this round.
    for (const enemy of actionOrder) ensureCombat(enemy).temporaryDodge = 0;
    for (const minion of battlefield(draft, "enemy").filter((unit) => unit.minion && unit.health > 0)) {
      tickStatuses(draft, minion, events);
      if (settle(draft, events)) return;
      if (minion.health <= 0) continue;
      decayBlock(draft, minion, events);
      startAction(minion, events, draft);
    }
    let enemyCardsPlayed = 0;
    for (const enemy of actionOrder) {
      if (enemy.health <= 0) continue;
      tickStatuses(draft, enemy, events);
      if (settle(draft, events)) return;
      if (enemy.health <= 0) continue;
      decayBlock(draft, enemy, events);
      const canAct = startAction(enemy, events, draft, false);
      if (enemy.deck) {
        enemy.deck.discard.push(...enemy.deck.hand.splice(0));
        enemy.deck.mana = TURN_MANA;
        drawBossCards(draft, enemy.deck, TURN_DRAW);
      }
      if (!canAct) continue;
      if (!battlefield(draft, "player").some((unit) => unit.health > 0)) continue;
      if (enemy.deck) {
        const deck = enemy.deck;
        // Bound automatic decision work even in a long Pearl/Mana chain.
        for (
          let action = 0;
          action < MAX_BATTLE_CARDS && deck.mana > 0 && deck.hand.length && enemy.health > 0;
          action++
        ) {
          const choice = chooseEnemyCard(draft, enemy, deck.hand.map(definition));
          if (!choice) break;
          const { def, targetId, allyTargetId } = choice;
          enemy.targetId = targetId ?? enemy.targetId;
          const lastCardInHand = playEnemyAbility(draft, enemy, def, targetId, allyTargetId, events);
          if (def.consume) deck.pearls--;
          removeDepartedMinions(draft);
          recycleDiscard(draft, deck);
          if (lastCardInHand) lastWarmth(draft, true, events);
          while (deck.hand.length < MAX_HAND_SIZE && deck.buffer.length) deck.hand.push(deck.buffer.shift()!);
          if (settle(draft, events)) return;
        }
        continue;
      }
      const fallen = battle.enemies.filter((unit) => unit.health <= 0);
      const inherited =
        unfinishedJourneyLimit(undefined, enemy) > ensureCombat(enemy).fallenCardsPlayedThisTurn
          ? fallen
              .flatMap((unit) => enemyAbilities.get(unit.species)!)
              .filter((card) => card.species !== enemy.species)
          : [];
      const choices = [...enemyAbilities.get(enemy.species)!, ...inherited];
      const abilities = choices.filter((card) => card.effect !== "resurrect" || fallen.length > 0);
      const choice = chooseEnemyCard(draft, enemy, abilities);
      if (!choice) continue;
      const { def, targetId, allyTargetId } = choice;
      enemy.targetId = targetId ?? enemy.targetId;
      enemy.lastAbility = def.id;
      if (inherited.includes(def)) ensureCombat(enemy).fallenCardsPlayedThisTurn++;
      playEnemyAbility(draft, enemy, def, targetId, allyTargetId, events);
      if (++enemyCardsPlayed === 2) livingChorus(draft, true, events);
      if (settle(draft, events)) return;
    }
    unhurried(draft, true, events);
    for (const c of [...battlefield(draft, "player"), ...draft.reserves]) {
      if (c.health <= 0) continue;
      tickStatuses(draft, c, events);
      if (settle(draft, events)) return;
    }
    for (const c of [...battlefield(draft, "player"), ...draft.reserves]) {
      const stats = ensureCombat(c);
      if (stats.grace > 0) stats.grace--;
      decayBlock(draft, c, events);
      if ("attacked" in c) c.attacked = false;
      startAction(c, events, draft);
    }
    battle.maxMana = battleMana(draft) + bonusMana;
    battle.mana = 0;
    gainMana(draft, battle.maxMana, events);
    battle.turn++;
    battle.cardsPlayedThisTurn = 0;
    intents(draft);
    if (
      battle.turn >= MAX_BATTLE_TURN ||
      pendingReplacement(draft) ||
      // Food may be drawn next and stays playable even when every creature must skip
      draft.cards.some((card) => card.ownerId === null) ||
      living(draft).some((c) => !controlled(c, draft)) ||
      draft.cards.some((card) => {
        const actor = cardActor(draft, card);
        return actor && actor.health > 0 && !controlled(actor, draft, definition(card.definitionId));
      }) ||
      draft.reserves.some((c) => c.health > 0 && !controlled(c, draft))
    )
      break;
  }
  draw(draft, TURN_DRAW, events);
  expressDelivery(draft, events);
  events.push({ kind: "turn", text: `Turn ${battle.turn}. ${battle.maxMana} Mana restored.` });
}
