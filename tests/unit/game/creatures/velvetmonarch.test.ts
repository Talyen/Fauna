import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch } from "../../../../src/game/engine";
import { definition } from "../../../../src/game/content";
import { cardText } from "../../../../src/game/card-rules";
import { grantBlock } from "../../../../src/game/combat/index";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { accept, authoredPack, prepareDestination, run, teamRun } from "../../../support/game";
import { playEnemyAbility } from "../../../../src/game/combat/enemy-action";
import { enemyCardValue } from "../../../../src/game/combat/enemy-policy";
import type { BattleState, GameEvent, GameState } from "../../../../src/game/types";

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
    autoEndTurn: false,
  });
  expect(result.accepted).toBe(true);
  return result;
}

describe("Velvetmonarch", () => {
  it("summons its garden and Royal Repose shields it while the Blooms attack", () => {
    let state = teamRun(42, ["velvetmonarch"]) as BattleState;
    expect(state.battle.minions?.map((unit) => [unit.name, unit.health])).toEqual([
      ["Royal Bloom", 6],
      ["Royal Bloom", 6],
    ]);
    state = produce(state, (draft) => {
      draft.team[0]!.health -= 4;
      for (const enemy of draft.battle.enemies) {
        enemy.combat.controlled = "stun";
        enemy.combat.controlTurns = 1;
      }
    });
    const result = play(state, "royalRepose");
    expect(result.state.team[0]!.health).toBe(60);
    expect(result.state.team[0]!.block).toBe(1);
    expect(result.state.battle!.minions!.map((unit) => unit.block)).toEqual([1, 1]);
    const attacks = result.events.filter(
      (event) => event.kind === "damage" && event.actorId?.startsWith("bloom-"),
    );
    expect(attacks).toHaveLength(2);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  });

  it("regrows one Bloom and heals the whole living garden even when it is full", () => {
    let state = produce(teamRun(42, ["velvetmonarch"]), (draft) => {
      draft.team[0]!.health = 52;
      draft.battle!.minions![0]!.health = 0;
      draft.battle!.minions![1]!.health = 3;
    });
    state = play(state, "meadowDecree").state;
    expect(state.team[0]!.health).toBe(54);
    expect(state.battle!.minions!.map((unit) => unit.health)).toEqual([6, 5]);
    state = play(state, "meadowDecree").state;
    expect(state.team[0]!.health).toBe(56);
    expect(state.battle!.minions!.map((unit) => unit.health)).toEqual([6, 6]);
  });

  it("shows the upgraded Bloom Health and summons at that value", () => {
    const state = produce(teamRun(42, ["velvetmonarch"]), (draft) => {
      draft.battle!.minions![0]!.health = 0;
      draft.cards.find((card) => card.definitionId === "velvetmonarch-meadow-decree")!.level = 1;
    });
    expect(cardText(definition("velvetmonarch-meadow-decree"), 1)).toContain("8 Health");
    const result = play(state, "meadowDecree").state;
    expect(result.battle!.minions![0]!.maxHealth).toBe(8);
  });

  it("responds to actual Block gains, not a minion's Block or a capped grant", () => {
    const events: GameEvent[] = [];
    produce(teamRun(42, ["velvetmonarch"]) as BattleState, (draft) => {
      const monarch = draft.team[0]!;
      grantBlock(draft, draft.battle.minions![0]!, 1, events);
      expect(events.filter((event) => event.kind === "damage")).toHaveLength(0);
      monarch.block = 1_000_000;
      grantBlock(draft, monarch, 1, events);
      expect(events.filter((event) => event.kind === "damage")).toHaveLength(0);
    });
  });

  it("uses the selected tier and only living uncontrolled Blooms answer", () => {
    const events: GameEvent[] = [];
    produce(teamRun(42, ["velvetmonarch"]) as BattleState, (draft) => {
      draft.discovery.recruited.velvetmonarch = 6;
      draft.battle.minions![0]!.health = 0;
      draft.battle.enemies.forEach((enemy) => {
        enemy.combat.controlled = "stun";
        enemy.combat.controlTurns = 1;
      });
      grantBlock(draft, draft.team[0]!, 1, events);
      expect(
        events.filter((event) => event.kind === "damage" && event.actorId?.startsWith("bloom-")),
      ).toHaveLength(1);
      expect(
        events.find((event) => event.kind === "damage" && event.actorId?.startsWith("bloom-"))?.amount,
      ).toBeGreaterThanOrEqual(6);
    });
  });

  it("appears as a boss and its enemy policy values and executes the same garden", () => {
    let state = produce(run(), (draft) => {
      draft.encounter = 3;
      draft.expedition = { pack: authoredPack(3, 1), recruit: null, lastRoom: "boss" };
      prepareDestination(draft);
      draft.journey!.victories = 3;
    });
    state = accept(state, { type: "beginBattle" });
    expect(state.battle!.enemies[0]!.species).toBe("velvetmonarch");
    expect(state.battle!.enemies[0]!.deck!.draw).toHaveLength(6);
    expect(state.battle!.minions!.map((unit) => unit.minion.side)).toEqual(["enemy", "enemy"]);
    state = produce(state, (draft) => {
      draft.battle!.enemies[0]!.health -= 4;
    });
    const ability = definition("velvetmonarch-royal-repose");
    expect(enemyCardValue(state as BattleState, state.battle!.enemies[0]!, ability)).toBeGreaterThan(0);
    const events: GameEvent[] = [];
    state = produce(state as BattleState, (draft) => {
      playEnemyAbility(draft, draft.battle.enemies[0]!, ability, undefined, undefined, events);
    });
    expect(
      events.filter((event) => event.kind === "damage" && event.actorId?.startsWith("bloom-")),
    ).toHaveLength(2);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it("damages and Blinds the opposing row", () => {
    const state = produce(teamRun(42, ["velvetmonarch"]), (draft) => {
      for (const enemy of draft.battle!.enemies) {
        enemy.combat.controlled = "stun";
        enemy.combat.controlTurns = 1;
      }
    });
    const result = play(state, "attack");
    expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
    expect(result.events.filter((event) => event.kind === "damage").length).toBeGreaterThan(0);
  });
});
