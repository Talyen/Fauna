import { describe, expect, it } from "vitest";
import { produce } from "immer";
import {
  accept,
  addReserve,
  authoredPack,
  prepareDestination,
  run,
  swapFixture,
  teamRun,
} from "../../../support/game";
import { dispatch } from "../../../../src/game/engine";
import { definition } from "../../../../src/game/content";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { freshCombat } from "../../../../src/game/combat/index";
import type { BattleState, GameState } from "../../../../src/game/types";

function play(state: GameState, effect: string) {
  const card = state.cards.find((entry) => definition(entry.definitionId).effect === effect)!;
  const ready = produce(state, (draft) => {
    for (const zone of ["draw", "hand", "discard", "buffer"] as const)
      draft.battle![zone] = draft.battle![zone].filter((id) => id !== card.id);
    draft.battle!.hand.push(card.id);
    draft.battle!.mana = 4;
  });
  const result = dispatch(ready, {
    type: "play",
    cardId: card.id,
    targetId: effect === "attack" ? ready.battle!.enemies[0]!.id : undefined,
    autoEndTurn: false,
  });
  expect(result.accepted).toBe(true);
  return result;
}

describe("Chronora", () => {
  it("summons its pendulums on entry and rebuilds one while preparing its next attack", () => {
    let state = teamRun(42, ["chronora"]) as BattleState;
    expect(state.battle.minions?.map((unit) => unit.name)).toEqual(["Pendulum", "Pendulum"]);
    state = produce(state, (draft) => {
      draft.discovery.recruited.chronora = 6;
      draft.team[0]!.health -= 8;
      draft.battle.minions![0]!.health = 0;
      draft.battle.enemies[0]!.combat.controlled = "stun";
      draft.battle.enemies[0]!.combat.controlTurns = 1;
    });
    state = play(state, "bridgeRewind").state as BattleState;
    expect(state.team[0]!.health).toBe(56);
    expect(state.team[0]!.combat?.turnBackReady).toBe(true);
    expect(state.battle.minions!.map((unit) => unit.health)).toEqual([6, 6]);
    expect(decodeSave(encodeSave(state))).toEqual(state);
    const strike = play(state, "attack");
    expect(
      strike.events
        .filter((event) => event.kind === "damage" && event.actorId === state.team[0]!.id)
        .map((event) => event.amount),
    ).toEqual([6, 6]);
    expect(strike.state.team[0]!.combat?.turnBackReady).toBe(false);
  });

  it("shields only living participants and removes its bonus when a pendulum falls", () => {
    let state = teamRun(42, ["chronora"]) as BattleState;
    state = produce(state, (draft) => {
      draft.battle.minions![0]!.health = 0;
      draft.battle.enemies[0]!.combat.controlled = "stun";
      draft.battle.enemies[0]!.combat.controlTurns = 1;
    });
    state = play(state, "teamNegate").state as BattleState;
    expect(state.team[0]!.combat?.negate).toBe(true);
    expect(state.battle.minions![1]!.combat.negate).toBe(true);
    expect(state.battle.minions![0]!.combat.negate).toBe(false);
    const strike = play(state, "attack");
    expect(
      strike.events.find((event) => event.kind === "damage" && event.actorId === state.team[0]!.id)?.amount,
    ).toBe(5);
  });

  it("does not prepare a repeat from overhealing, and restores only one broken clock", () => {
    const state = produce(teamRun(42, ["chronora"]), (draft) => {
      for (const pendulum of draft.battle!.minions!) pendulum.health = 0;
    });
    const result = play(state, "bridgeRewind").state;
    expect(result.team[0]!.combat?.turnBackReady).not.toBe(true);
    expect(result.battle!.minions!.map((unit) => unit.health)).toEqual([6, 0]);
    const forged = produce(result, (draft) => {
      draft.battle!.minions![0]!.combat.turnBackReady = true;
    });
    expect(() => decodeSave(encodeSave(forged))).toThrow();
  });

  it("revokes departing pendulums and recreates them when Chronora returns", () => {
    let state = produce(teamRun(42, ["chronora"]), (draft) => {
      addReserve(draft, "backup", "mossguard", 32, freshCombat());
    });
    state = swapFixture(state, { type: "swap", activeId: state.team[0]!.id, reserve: "backup" });
    expect(state.battle!.minions!.every((unit) => unit.health === 0)).toBe(true);
    state = swapFixture(state, { type: "swap", activeId: "backup", reserve: "ally-0" });
    expect(state.battle!.minions!.map((unit) => unit.health)).toEqual([6, 6]);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it("enters the final boss battle with its own six cards and pendulums", () => {
    let state = produce(run(), (draft) => {
      draft.encounter = 29;
      draft.expedition = { pack: authoredPack(29), recruit: null, lastRoom: "boss" };
      prepareDestination(draft);
      draft.journey!.victories = 29;
    });
    state = accept(state, { type: "beginBattle" });
    expect(state.battle!.enemies[0]!.species).toBe("chronora");
    expect(state.battle!.enemies[0]!.deck!.draw).toHaveLength(6);
    expect(state.battle!.minions!.map((unit) => unit.minion.side)).toEqual(["enemy", "enemy"]);
    expect(decodeSave(encodeSave(state))).toEqual(state);
    state = accept(state, { type: "endTurn" });
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });
});
