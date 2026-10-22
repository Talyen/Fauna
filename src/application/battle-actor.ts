import { rankedBattleChoices, type BattleChoice } from "./battle-policy";
import type { Card, Command, GameState } from "../game/types";

/** Public combat state only; hidden draw order, RNG, XP and copy serials are not progress. */
function tacticalState(state: GameState): string {
  if (state.phase !== "battle") return state.phase;
  const battle = state.battle;
  const card = (entry: Card) => [entry.ownerId, entry.definitionId, entry.level, !!entry.temporary];
  const unit = (entry: GameState["team"][number]) => [
    entry.id,
    entry.species,
    entry.health,
    entry.block,
    entry.attacked,
    entry.combat,
  ];
  return JSON.stringify([
    state.team.map(unit),
    state.reserves.map(unit),
    battle.enemies.map((entry) => [entry.id, entry.species, entry.health, entry.block, entry.combat]),
    battle.minions?.map((entry) => [entry.id, entry.health, entry.block, entry.combat, entry.minion]),
    battle.hand.map((id) => JSON.stringify(card(state.cards.find((entry) => entry.id === id)!))).sort(),
    state.cards.map((entry) => JSON.stringify(card(entry))).sort(),
    battle.draw.length,
    battle.discard.length,
    battle.buffer.length,
    battle.mana,
    battle.maxMana,
    battle.cardsPlayedThisTurn,
    battle.freeBurnUsed,
    battle.meteoriteUsed,
    state.talents,
    state.boons,
    state.discovery.recruited,
  ]);
}
function actionKey(state: GameState, command: Command): string {
  if (command.type !== "play") return JSON.stringify(command);
  const card = state.cards.find((entry) => entry.id === command.cardId)!;
  return JSON.stringify([card.ownerId, card.definitionId, card.level, command.targetId]);
}

/** One owner per automated session; history survives its ordinary save/resume cycles. */
export function createBattleActor() {
  const attempted = new Map<string, Set<string>>();
  let scope = "",
    revision = -1;
  let previous: BattleChoice | undefined;
  const reset = () => {
    attempted.clear();
    scope = "";
    revision = -1;
    previous = undefined;
  };
  return {
    reset,
    choose(state: GameState, autoEndTurn = true): BattleChoice {
      const currentScope =
        state.phase === "battle"
          ? JSON.stringify([state.encounter, state.expedition?.pack, state.battle.turn])
          : "";
      if (
        !currentScope ||
        currentScope !== scope ||
        state.revision < revision ||
        state.revision > revision + 1
      )
        reset();
      // Reading a decision twice does not count as attempting it twice.
      if (state.revision === revision && previous) {
        return previous.command.type === "play" || previous.command.type === "swap"
          ? { ...previous, command: { ...previous.command, autoEndTurn } }
          : previous;
      }
      scope = currentScope;
      const visible = tacticalState(state);
      const tried = attempted.get(visible) ?? new Set<string>();
      const choices = rankedBattleChoices(state, autoEndTurn);
      const selected = choices.find((choice) => !tried.has(actionKey(state, choice.command)));
      previous = selected ?? {
        command: { type: "endTurn" },
        score: 0,
        reason: choices.length
          ? "End the turn after useful alternatives repeat an unchanged combat state"
          : "No affordable playable card has a scored visible benefit",
      };
      tried.add(actionKey(state, previous.command));
      attempted.set(visible, tried);
      // Bound long productive turns without restricting their actions.
      if (attempted.size > 256) attempted.delete(attempted.keys().next().value!);
      revision = state.revision;
      return previous;
    },
  };
}
