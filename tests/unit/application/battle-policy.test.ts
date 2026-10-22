import { expect, it } from "vitest";
import { produce } from "immer";
import { chooseBattleCommand } from "../../../src/application/battle-policy";
import { dispatch } from "../../../src/game/engine";
import { teamRun } from "../../support/game";

it.each(["reedstag", "chimecricket"] as const)(
  "Auto-play uses %s healing to Cleanse a full-health recipient",
  (kind) => {
    const state = produce(teamRun(42, [kind]), (game) => {
      const card = game.cards.find((card) => card.definitionId === `${kind}-heal`)!;
      game.battle!.hand = [card.id];
      game.battle!.buffer = [];
      game.battle!.discard = [];
      game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((card) => card.id);
      game.team[0]!.combat!.poison = 8;
    });
    const command = chooseBattleCommand(state, false);
    expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0]! });
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.combat!.poison).toBe(0);
    expect(result.state.team[0]!.health).toBe(state.team[0]!.health);
    const clean = produce(state, (game) => {
      game.team[0]!.combat!.poison = 0;
    });
    expect(chooseBattleCommand(clean, false)).toEqual({ type: "endTurn" });
  },
);

it.each(["mossguard-guard", "pollenmoth-teamGuard", "ringpalm-teamProtection"])(
  "Auto-play adds protection with %s even when existing Block exceeds the card value",
  (definitionId) => {
    const state = produce(teamRun(42, ["mossguard", "pollenmoth", "ringpalm"]), (game) => {
      const card = game.cards.find((card) => card.definitionId === definitionId)!;
      game.battle!.hand = [card.id];
      game.battle!.buffer = [];
      game.battle!.discard = [];
      game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((card) => card.id);
      for (const ally of game.team) {
        ally.block = 10;
        ally.combat!.thorns = 10;
      }
    });
    const command = chooseBattleCommand(state, false);
    expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0]! });
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    expect(result.state.team[0]!.block).toBeGreaterThan(state.team[0]!.block);
    expect(result.state.battle!.turn).toBe(state.battle!.turn);
    expect(state.team[0]!.block).toBe(10);
    const capped = produce(state, (game) => {
      for (const ally of game.team) {
        ally.block = 1_000_000;
        ally.combat!.thorns = 1_000_000;
      }
    });
    expect(chooseBattleCommand(capped, false)).toEqual({ type: "endTurn" });
  },
);
