import { roll } from "../random";
import { executeAbility } from "./abilities";
import { creaturePassive, hasTalent } from "../progression";
import {
  combat,
  gainMana,
  restoreHealth,
  mostInjured,
  startAction,
  tickStatuses,
  controlled,
  TURN_MANA,
  TURN_DRAW,
} from "./index";
import { draw } from "../card-zones";
import { retainedBlock, enemyAbilityValue } from "../rules";
import { CARDS, enemyCard, enemyCanUse } from "../content";
import type { GameEvent, GameState, BattleState } from "../types";
import { living, swapFromCard } from "../team";
import { settle, intents } from "../journey";

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
export function finishTurn(draft: BattleState, events: GameEvent[]) {
  const battle = draft.battle;
  const bonusMana = Number(
    battle.mana > 0 ? hasTalent(draft, "mana.wellspring") : hasTalent(draft, "mana.dark-recovery"),
  );
  // Enemy-phase draws and existing overflow survive into the next player turn.
  battle.discard.push(...battle.hand.splice(0));
  for (let pass = 0; pass < 3; pass++) {
    // Swaps can reorder the battlefield; each enemy keeps its single action window.
    const actionOrder = battle.enemies.slice();
    let enemyCardsPlayed = 0;
    for (const enemy of actionOrder) {
      if (enemy.health <= 0) continue;
      tickStatuses(draft, enemy, events);
      if (settle(draft, events)) return;
      if (enemy.health <= 0) continue;
      enemy.block = retainedBlock(enemy);
      if (!startAction(enemy, events, draft)) continue;
      const target = living(draft).find((c) => c.id === enemy.targetId) ?? living(draft)[0];
      if (!target) continue;
      const abilities = CARDS.filter((card) => card.species === enemy.species && enemyCanUse(card));
      const alternatives = abilities.filter((card) => card.id !== enemy.lastAbility);
      const pool = alternatives.length ? alternatives : abilities;
      const def = enemyCard(pool[Math.floor(roll(draft) * pool.length)]!);
      enemy.lastAbility = def.id;
      executeAbility(
        draft,
        {
          side: "enemy",
          actor: enemy,
          def,
          value: enemyAbilityValue(enemy, def),
          targetId: target.id,
          allyTargetId: def.effect === "heal" ? mostInjured(battle.enemies)?.id : enemy.id,
        },
        events,
        { swap: swapFromCard },
      );
      if (++enemyCardsPlayed === 2) livingChorus(draft, true, events);
      if (settle(draft, events)) return;
    }
    for (const c of [...draft.team, ...draft.reserves]) {
      if (c.health <= 0) continue;
      tickStatuses(draft, c, events);
      if (settle(draft, events)) return;
    }
    for (const c of [...draft.team, ...draft.reserves]) {
      const stats = combat(c);
      if (stats.grace > 0) stats.grace--;
      c.block = retainedBlock(c, draft);
      c.attacked = false;
      startAction(c, events, draft);
    }
    battle.maxMana = TURN_MANA + Number(hasTalent(draft, "mana.leyline-attunement")) + bonusMana;
    battle.mana = 0;
    gainMana(draft, battle.maxMana, events);
    battle.turn++;
    battle.cardsPlayedThisTurn = 0;
    intents(draft);
    if (
      living(draft).some((c) => !controlled(c)) ||
      draft.reserves.some((c) => c.health > 0 && !controlled(c))
    )
      break;
  }
  draw(draft, TURN_DRAW);
  events.push({ kind: "turn", text: `Turn ${battle.turn}. ${battle.maxMana} Mana restored.` });
}
