import { expect, it } from "vitest";
import { produce } from "immer";
import reedstag from "./fixtures/cadenza-reedstag.json";
import tournelle from "./fixtures/cadenza-tournelle.json";
import { createBattleActor } from "../../../src/application/battle-actor";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { accept, teamRun } from "../../support/game";

it.each([reedstag, tournelle])("escapes a recorded Resonant Well cycle across save/resume", (fixture) => {
  let state = decodeSave(JSON.stringify(fixture));
  const actor = createBattleActor();
  const uninterrupted = createBattleActor();
  let withoutResume = state;
  const turn = state.battle!.turn;
  const untouched = encodeSave(state);
  const first = actor.choose(state, false);
  expect(actor.choose(state, false)).toEqual(first);
  expect(encodeSave(state)).toBe(untouched);
  expect(first.command.type).toBe("play");
  for (let count = 0; count < 32 && state.phase === "battle" && state.battle.turn === turn; count++) {
    const selected = actor.choose(state, false);
    expect(uninterrupted.choose(withoutResume, false)).toEqual(selected);
    const result = dispatch(state, selected.command);
    const continuous = dispatch(withoutResume, selected.command);
    expect(result.accepted).toBe(true);
    expect(continuous.accepted).toBe(true);
    withoutResume = continuous.state;
    state = decodeSave(encodeSave(result.state));
    expect(encodeSave(withoutResume)).toBe(encodeSave(state));
  }
  expect(state.phase !== "battle" || state.battle.turn > turn).toBe(true);
});

it("keeps playing productive Memento cards without an attacks-per-turn cap", () => {
  const start = teamRun(42, ["memento"]);
  const procession = start.cards.find((card) => card.definitionId === "memento-lost-procession")!;
  let state = produce(accept(start, { type: "play", cardId: procession.id, autoEndTurn: false }), (game) => {
    game.battle!.mana = 6;
    game.battle!.maxMana = 6;
    game.battle!.enemies.forEach((enemy) => {
      enemy.health = 1000;
      enemy.block = 0;
    });
  });
  const actor = createBattleActor();
  let damagingPlays = 0;
  for (let count = 0; count < 20 && state.phase === "battle" && state.battle.mana > 0; count++) {
    const before = state.battle.enemies.reduce((sum, enemy) => sum + enemy.health, 0);
    const command = actor.choose(state, false).command;
    if (command.type === "endTurn") break;
    expect(command.type).toBe("play");
    const result = dispatch(state, command);
    expect(result.accepted).toBe(true);
    state = result.state;
    if (state.battle!.enemies.reduce((sum, enemy) => sum + enemy.health, 0) < before) damagingPlays++;
  }
  expect(damagingPlays).toBeGreaterThan(3);
});

it("recognizes Encore Baton progress when a visible decision recurs", () => {
  const state = produce(decodeSave(JSON.stringify(reedstag)), (draft) => {
    draft.boons.push("encore-baton");
  });
  const actor = createBattleActor();
  const first = actor.choose(state, false);
  const progressed = produce(state, (draft) => {
    draft.battle!.encoreProgress = 1;
    draft.revision++;
  });
  expect(actor.choose(progressed, false).command).toEqual(first.command);
});

it("resets cycle history for a new turn and explicit manual takeover", () => {
  let state = decodeSave(JSON.stringify(reedstag));
  const actor = createBattleActor();
  const first = actor.choose(state, false);
  // A committed revision with unchanged visible combat state revisits the same decision.
  state = produce(state, (game) => {
    game.revision++;
  });
  expect(actor.choose(state, false).command).not.toEqual(first.command);
  actor.reset();
  expect(actor.choose(state, false).command).toEqual(first.command);
  const next = produce(state, (game) => {
    game.battle!.turn++;
    game.revision++;
  });
  expect(actor.choose(next, false).command).toEqual(first.command);
});
