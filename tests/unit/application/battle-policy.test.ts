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
    expect(result.state.team[0]!.block + result.state.team[0]!.combat!.thorns).toBeGreaterThan(
      state.team[0]!.block + state.team[0]!.combat!.thorns,
    );
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

it("Auto-play avoids recovering Echoes Remember itself or a knocked-out owner's card", () => {
  const state = produce(teamRun(42, ["cadenza", "mossguard"]), (game) => {
    const recover = game.cards.find((card) => card.definitionId === "cadenza-echoes-remember")!;
    game.battle!.hand = [recover.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((card) => card.id !== recover.id).map((card) => card.id);
  });
  expect(chooseBattleCommand(state, false)).toEqual({ type: "endTurn" });
  const useful = produce(state, (game) => {
    game.battle!.discard.push(game.battle!.draw.pop()!);
  });
  expect(chooseBattleCommand(useful, false)).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
  const inert = produce(useful, (game) => {
    game.team[1]!.health = 0;
  });
  expect(chooseBattleCommand(inert, false)).toEqual({ type: "endTurn" });
});

it.each([
  ["bloomquail", "health.overflow"],
  ["reedstag", "health.overflow"],
  ["bloomquail", "health.clean-slate"],
] as const)(
  "Auto-play uses %s full-health healing for %s and stops when it has no benefit",
  (kind, talent) => {
    const state = produce(teamRun(42, [kind]), (game) => {
      const heal = game.cards.find((card) => card.definitionId === `${kind}-heal`)!;
      game.battle!.hand = [heal.id];
      game.battle!.buffer = [];
      game.battle!.discard = [];
      game.battle!.draw = game.cards.filter((card) => card.id !== heal.id).map((card) => card.id);
      game.talents = [talent];
      for (const enemy of game.battle!.enemies) enemy.combat.blind = true;
      if (talent === "health.clean-slate") {
        game.team[0]!.combat!.poison = 2;
      }
    });
    const command = chooseBattleCommand(state, false);
    expect(command).toMatchObject({ type: "play", cardId: state.battle!.hand[0] });
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    if (talent === "health.overflow")
      expect(result.state.team[0]!.block).toBeGreaterThan(state.team[0]!.block);
    else expect(result.state.team[0]!.combat!.poison).toBe(0);
    const spent = produce(state, (game) => {
      game.team[0]!.combat!.burn = 0;
      game.team[0]!.combat!.poison = 0;
      game.team[0]!.block = 1_000_000;
    });
    expect(chooseBattleCommand(spent, false)).toEqual({ type: "endTurn" });
  },
);
