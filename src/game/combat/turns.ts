import { MAX_BATTLE_TURN } from "../state-limits";
import { boonRule } from "../rules/boons";
import { battleMana, renewalManaBonus } from "./battle-modifiers";
import { cardActor, unfinishedJourneyLimit } from "../card-actors";
import { battlefield, livingBattlefield, isEnemy, healingAllies } from "../battlefield";
import { definition, speciesCards, SPECIES, type SpeciesId, type CardDefinition } from "../content";
import { drawBossCards, removeDepartedMinions } from "./legendary";
import { CLOCKWORK_BEE } from "../content/creatures/tinkervale";
import { chooseEnemyCard } from "./enemy-policy";
import { lastWarmth } from "./card-modifiers";
import { promoteBufferedCards, MAX_BATTLE_CARDS, MAX_HAND_SIZE } from "../card-zones";
import { playEnemyAbility } from "./enemy-action";
import { passiveAmount } from "../progression";
import {
  ensureCombat,
  removeEffects,
  gainMana,
  grantBlock,
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
import { drawAtTurnStart, expressDelivery } from "../card-zones";
import { retainedBlock } from "../ability-rules";
import { enemyCard, enemyCanUse } from "../card-rules";
import type { GameEvent, GameState, BattleState } from "../types";
import { pendingReplacement } from "../team";
import { settle, intents } from "../journey";

// Adapt immutable authored kits once for both value estimation and execution.
const enemyAbilities = new Map<SpeciesId, CardDefinition[]>();
const enemyAbilitiesWithoutResurrection = new Map<SpeciesId, CardDefinition[]>();
for (const { id } of SPECIES) {
  const cards: CardDefinition[] = [];
  const withoutResurrection: CardDefinition[] = [];
  for (const card of speciesCards(id)) {
    if (!enemyCanUse(card)) continue;
    const adapted = enemyCard(card);
    cards.push(adapted);
    if (adapted.effect !== "resurrect") withoutResurrection.push(adapted);
  }
  enemyAbilities.set(id, cards);
  enemyAbilitiesWithoutResurrection.set(id, withoutResurrection);
}

/** Convert only Block lost to ordinary turn decay, using the owner's passive tier. */
export function decayBlock(state: GameState, unit: Combatant, events: GameEvent[]) {
  const before = unit.block;
  const allied = !isEnemy(unit);
  if (allied && state.boons.includes("caravan-rug") && state.reserves.some((ally) => ally.id === unit.id))
    return;
  if (allied && state.boons.includes("winterseed") && ensureCombat(unit).controlled === "freeze") return;
  const retained = retainedBlock(unit, allied ? state : undefined);
  unit.block =
    allied && state.boons.includes("geode-anvil")
      ? Math.max(retained, Math.min(before, ensureCombat(unit).armor))
      : retained;
  if (allied && ensureCombat(unit).armor > 0 && state.boons.includes("wax-foundation-mold"))
    unit.block = Math.max(unit.block, Math.round((before * boonRule("wax-foundation-mold").percent) / 100));
  const lost = before - unit.block;
  if (lost <= 0 || unit.health <= 0) return;
  const percent = passiveAmount(allied ? state : undefined, unit.species, "fallenLeaves");
  if (percent > 0) grantStatus(unit, "thorns", Math.round((lost * percent) / 100), events, state);
  const shadow = passiveAmount(allied ? state : undefined, unit.species, "livingShadow");
  const deployed = allied
    ? state.team.some((ally) => ally.id === unit.id)
    : state.battle?.enemies.some((ally) => ally.id === unit.id);
  if (shadow > 0 && deployed) {
    const recipient = mostInjured(livingBattlefield(state, allied ? "player" : "enemy"));
    if (recipient) grantBlock(state, recipient, Math.round((lost * shadow) / 100), events);
  }
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
  const row = livingBattlefield(state, enemy ? "enemy" : "player");
  for (const dreamer of row) {
    if (dreamer.health <= 0) continue;
    const amount = passiveAmount(enemy ? undefined : state, dreamer.species, "unhurried");
    if (amount <= 0) continue;
    for (const recipient of healingAllies(state, enemy ? "enemy" : "player")) {
      if (dreamer.health <= 0) break;
      if (ensureCombat(recipient).cardsPlayedThisTurn === 0)
        restoreHealth(recipient, amount, events, false, state, false, dreamer);
    }
  }
}
export function finishTurn(draft: BattleState, events: GameEvent[]) {
  const battle = draft.battle;
  const unspentMana = battle.mana;
  if (draft.boons.includes("nightbloom-bell"))
    for (const ally of [...livingBattlefield(draft, "player"), ...draft.reserves])
      if (ally.health > 0 && ally.combat?.blind)
        removeEffects(ally, "cleanse", 1, events, draft, "blind", undefined, false);
  if (draft.boons.includes("dew-pendulum") && unspentMana > 0)
    for (const ally of livingBattlefield(draft, "player")) grantBlock(draft, ally, unspentMana, events);
  // Enemy-phase draws and existing overflow survive into the next player turn.
  battle.discard.push(...battle.hand.splice(0));
  for (let pass = 0; pass < 3; pass++) {
    const bonusMana = renewalManaBonus(draft);
    unhurried(draft, false, events);
    // Swaps can reorder the battlefield; each enemy keeps its single action window.
    const actionOrder = battle.enemies.slice();
    // Expire the previous round before an ally can grant Dodge for this round.
    for (const enemy of actionOrder) {
      ensureCombat(enemy).temporaryDodge = 0;
      ensureCombat(enemy).dodgeFreezeRetaliation = 0;
    }
    const actingMinions = battle.minions?.length ? battlefield(draft, "enemy") : [];
    let minionCount = 0;
    for (const unit of actingMinions) if (unit.minion && unit.health > 0) actingMinions[minionCount++] = unit;
    actingMinions.length = minionCount;
    for (const minion of actingMinions) {
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
        drawBossCards(draft, enemy.deck, TURN_DRAW, true);
      }
      if (!canAct) continue;
      // A deployed summon also requires a living deployed owner.
      if (!draft.team.some((unit) => unit.health > 0)) continue;
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
          if (lastCardInHand) lastWarmth(draft, true, events);
          promoteBufferedCards(deck, MAX_HAND_SIZE);
          if (settle(draft, events)) return;
        }
        continue;
      }
      const hasFallen = battle.enemies.some((unit) => unit.health <= 0);
      let inherited: ReturnType<typeof enemyCard>[] | undefined;
      if (
        hasFallen &&
        unfinishedJourneyLimit(undefined, enemy) > ensureCombat(enemy).fallenCardsPlayedThisTurn
      )
        for (const unit of battle.enemies)
          if (unit.health <= 0)
            for (const card of enemyAbilities.get(unit.species)!)
              if (card.species !== enemy.species) (inherited ??= []).push(card);
      const own = enemyAbilities.get(enemy.species)!;
      const abilities = hasFallen
        ? inherited
          ? [...own, ...inherited]
          : own
        : enemyAbilitiesWithoutResurrection.get(enemy.species)!;
      const candidates = enemy.clockworkBees ? [...abilities, CLOCKWORK_BEE] : abilities;
      const choice = chooseEnemyCard(draft, enemy, candidates);
      if (!choice) continue;
      const { def, targetId, allyTargetId } = choice;
      enemy.targetId = targetId ?? enemy.targetId;
      enemy.lastAbility = def.id;
      if (inherited?.includes(def)) ensureCombat(enemy).fallenCardsPlayedThisTurn++;
      playEnemyAbility(draft, enemy, def, targetId, allyTargetId, events);
      if (++enemyCardsPlayed === 2) livingChorus(draft, true, events);
      if (settle(draft, events)) return;
    }
    unhurried(draft, true, events);
    const ticking = battlefield(draft, "player");
    ticking.push(...draft.reserves);
    for (const c of ticking) {
      if (c.health <= 0) continue;
      tickStatuses(draft, c, events);
      if (settle(draft, events)) return;
    }
    const starting = battlefield(draft, "player");
    starting.push(...draft.reserves);
    for (const c of starting) {
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
      draft.team.some((c) => c.health > 0 && !controlled(c, draft)) ||
      draft.cards.some((card) => {
        const actor = cardActor(draft, card);
        return actor && actor.health > 0 && !controlled(actor, draft, definition(card.definitionId));
      }) ||
      draft.reserves.some((c) => c.health > 0 && !controlled(c, draft))
    )
      break;
  }
  drawAtTurnStart(draft, TURN_DRAW, events);
  expressDelivery(draft, events);
  events.push({ kind: "turn", text: `Turn ${battle.turn}. ${battle.maxMana} Mana restored.` });
}
