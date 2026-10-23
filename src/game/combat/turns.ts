import { unfinishedJourneyLimit } from "../card-actors";
import { battlefield, isEnemy } from "../battlefield";
import { definition, speciesCards, SPECIES } from "../content";
import { drawBossCards, bossCardPriority, courtRemembers, removeDepartedMinions } from "./legendary";
import { recycleDiscard, MAX_BATTLE_CARDS, MAX_HAND_SIZE } from "../card-zones";
import { roll } from "../random";
import { executeAbility } from "./abilities";
import { creaturePassive, hasTalent } from "../progression";
import {
  ensureCombat,
  gainMana,
  restoreHealth,
  mostInjured,
  startAction,
  grantStatus,
  tickStatuses,
  controlled,
  TURN_MANA,
  TURN_DRAW,
  type Combatant,
} from "./index";
import { draw } from "../card-zones";
import { retainedBlock, enemyAbilityValue } from "../ability-rules";
import { enemyCard, enemyCanUse } from "../card-rules";
import type { GameEvent, GameState, BattleState } from "../types";
import { living, pendingReplacement, swapFromCard } from "../team";
import { settle, intents } from "../journey";

// Adapt immutable authored kits once; selection order and RNG consumption stay
// the same, while enemy turns reuse their read-only ability definitions.
const enemyAbilities = new Map(
  SPECIES.map(({ id }) => [id, speciesCards(id).filter(enemyCanUse).map(enemyCard)]),
);

/** Convert only Block lost to ordinary turn decay, using the owner's passive tier. */
export function decayBlock(state: GameState, unit: Combatant, events: GameEvent[]) {
  const before = unit.block;
  const allied = !isEnemy(unit);
  unit.block = retainedBlock(unit, allied ? state : undefined);
  const lost = before - unit.block;
  if (lost <= 0 || unit.health <= 0) return;
  const percent = creaturePassive(allied ? state : undefined, unit.species).effects.reduce(
    (sum, effect) => sum + (effect.kind === "fallenLeaves" ? effect.amount : 0),
    0,
  );
  if (percent > 0) grantStatus(unit, "thorns", Math.round((lost * percent) / 100), events, state);
}

export function livingChorus(state: GameState, enemy: boolean, events: GameEvent[]) {
  const row = enemy ? state.battle!.enemies : state.team;
  for (const singer of row) {
    if (singer.health <= 0) continue;
    const amount = creaturePassive(enemy ? undefined : state, singer.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "livingChorus" ? effect.amount : 0),
      0,
    );
    const recipient = amount > 0 ? mostInjured<import("../combat/index").Combatant>(row) : undefined;
    if (recipient) restoreHealth(recipient, amount, events, false, state, false, singer);
  }
}
export function unhurried(state: BattleState, enemy: boolean, events: GameEvent[]) {
  const row = battlefield(state, enemy ? "enemy" : "player").filter((unit) => unit.health > 0);
  for (const dreamer of row) {
    const amount = creaturePassive(enemy ? undefined : state, dreamer.species).effects.reduce(
      (sum, effect) => sum + (effect.kind === "unhurried" ? effect.amount : 0),
      0,
    );
    if (amount <= 0) continue;
    for (const recipient of row)
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
    const bonusMana = Number(
      battle.mana > 0 ? hasTalent(draft, "mana.wellspring") : hasTalent(draft, "mana.dark-recovery"),
    );
    unhurried(draft, false, events);
    // Swaps can reorder the battlefield; each enemy keeps its single action window.
    const actionOrder = battle.enemies.slice();
    // Expire the previous round before an ally can grant Dodge for this round.
    for (const enemy of actionOrder) ensureCombat(enemy).temporaryDodge = 0;
    for (const minion of battlefield(draft, "enemy").filter((unit) => unit.minion && unit.health > 0)) {
      tickStatuses(draft, minion, events);
      if (settle(draft, events)) return;
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
      const targets = () => battlefield(draft, "player").filter((unit) => unit.health > 0);
      const availableTargets = targets();
      const target = availableTargets.find((c) => c.id === enemy.targetId) ?? availableTargets[0];
      if (!target) continue;
      if (enemy.deck) {
        const deck = enemy.deck;
        // Bound automatic decision work even in a long Pearl/Mana chain.
        for (
          let action = 0;
          action < MAX_BATTLE_CARDS && deck.mana > 0 && deck.hand.length && enemy.health > 0;
          action++
        ) {
          let id = deck.hand[0]!;
          let priority = bossCardPriority(draft, enemy, id);
          for (let index = 1; index < deck.hand.length; index++) {
            const candidate = deck.hand[index]!;
            const candidatePriority = bossCardPriority(draft, enemy, candidate);
            if (candidatePriority > priority) {
              id = candidate;
              priority = candidatePriority;
            }
          }
          const def = definition(id);
          const targetsNow = targets();
          if (!targetsNow.length) break;
          const victim = targetsNow[Math.floor(roll(draft) * targetsNow.length)]!;
          deck.hand.splice(deck.hand.indexOf(id), 1);
          if (!def.consume) deck.discard.push(id);
          deck.mana -= def.cost;
          executeAbility(
            draft,
            {
              side: "enemy",
              actor: enemy,
              def,
              value: enemyAbilityValue(enemy, def),
              targetId: victim.id,
              allyTargetId: enemy.id,
            },
            events,
            { swap: swapFromCard },
          );
          courtRemembers(draft, enemy, events);
          if (def.consume) deck.pearls--;
          removeDepartedMinions(draft);
          recycleDiscard(draft, deck);
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
      const alternatives = abilities.filter((card) => card.id !== enemy.lastAbility);
      const pool = alternatives.length ? alternatives : abilities;
      const def = pool[Math.floor(roll(draft) * pool.length)]!;
      enemy.lastAbility = def.id;
      if (inherited.includes(def)) ensureCombat(enemy).fallenCardsPlayedThisTurn++;
      executeAbility(
        draft,
        {
          side: "enemy",
          actor: enemy,
          def,
          value: enemyAbilityValue(enemy, def),
          targetId: target.id,
          allyTargetId:
            def.effect === "resurrect"
              ? fallen[0]?.id
              : def.effect === "heal"
                ? mostInjured(battle.enemies)?.id
                : enemy.id,
        },
        events,
        { swap: swapFromCard },
      );
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
    battle.maxMana = TURN_MANA + Number(hasTalent(draft, "mana.leyline-attunement")) + bonusMana;
    battle.mana = 0;
    gainMana(draft, battle.maxMana, events);
    battle.turn++;
    battle.cardsPlayedThisTurn = 0;
    intents(draft);
    if (
      pendingReplacement(draft) ||
      living(draft).some((c) => !controlled(c)) ||
      draft.reserves.some((c) => c.health > 0 && !controlled(c))
    )
      break;
  }
  draw(draft, TURN_DRAW, events);
  events.push({ kind: "turn", text: `Turn ${battle.turn}. ${battle.maxMana} Mana restored.` });
}
