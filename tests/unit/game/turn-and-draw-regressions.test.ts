import { expect, it } from "vitest";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { drawHasAnotherCard } from "../../../src/game/card-zones";
import { freshCombat } from "../../../src/game/combat";
import { summonEcho } from "../../../src/game/combat/legendary";
import { finishTurn } from "../../../src/game/combat/turns";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { requireBattle, teamRun } from "../../support/game";
import type { GameEvent } from "../../../src/game/types";

it("does not value buffered promotion as a new draw for Auto-play", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["stillara", "mossguard", "prismram"])));
  const card = state.cards.find((entry) => entry.definitionId === "stillara-thaw-path")!;
  const others = state.cards.filter((entry) => entry.id !== card.id);
  state.battle.hand = [card.id, ...others.slice(0, 5).map((entry) => entry.id)];
  state.battle.buffer = others.slice(5).map((entry) => entry.id);
  state.battle.draw = [];
  state.battle.discard = [];
  expect(decodeSave(encodeSave(state))).toEqual(state);
  expect(drawHasAnotherCard(state, card, { kind: "draw", amount: 1 })).toBe(false);
  expect(
    rankedBattleChoices(state, false).some(
      (choice) => choice.command.type === "play" && choice.command.cardId === card.id,
    ),
  ).toBe(false);
});

it("does not spend Mana on True Bearing when its only draw is itself", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["aerostat", "mossguard", "prismram"])));
  const card = state.cards.find((entry) => entry.definitionId === "aerostat-true-bearing")!;
  const others = state.cards.filter((entry) => entry.id !== card.id);
  state.battle.hand = [card.id, ...others.slice(0, 5).map((entry) => entry.id)];
  state.battle.buffer = others.slice(5).map((entry) => entry.id);
  state.battle.draw = [];
  state.battle.discard = [];
  expect(decodeSave(encodeSave(state))).toEqual(state);
  expect(
    rankedBattleChoices(state, false).some(
      (choice) => choice.command.type === "play" && choice.command.cardId === card.id,
    ),
  ).toBe(false);
});

it("uses Echoes Remember to heal its owner when only that card can be recovered", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["cadenza", "wisterelle", "mossguard"])));
  const card = state.cards.find((entry) => entry.definitionId === "cadenza-echoes-remember")!;
  state.team[0]!.health -= 4;
  state.battle.hand = [card.id];
  state.battle.buffer = [];
  state.battle.discard = [];
  state.battle.draw = state.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
  const choice = rankedBattleChoices(state, false).find(
    (entry) => entry.command.type === "play" && entry.command.cardId === card.id,
  );
  expect(choice).toBeDefined();
  const result = dispatch(state, choice!.command);
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.health).toBe(state.team[0]!.health + 1);
});

it("uses Echoes Remember to draw another owner's card with Journey Loom", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["cadenza", "mossguard", "prismram"])));
  const card = state.cards.find((entry) => entry.definitionId === "cadenza-echoes-remember")!;
  state.boons = ["journey-loom"];
  state.battle.hand = [card.id];
  state.battle.buffer = [];
  state.battle.discard = [];
  state.battle.draw = state.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
  const choice = rankedBattleChoices(state, false).find(
    (entry) => entry.command.type === "play" && entry.command.cardId === card.id,
  );
  expect(choice).toBeDefined();
  const result = dispatch(state, choice!.command);
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.hand).toContain(card.id);
  expect(
    result.state.battle!.hand.some(
      (id) => result.state.cards.find((entry) => entry.id === id)?.ownerId !== card.ownerId,
    ),
  ).toBe(true);
});

it("does not give a defeated Echo a Freeze recovery window after its status tick", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram", "captoad"])));
  const owner = state.battle.enemies[0]!;
  owner.species = "memento";
  summonEcho(state, owner, "enemy", 1, []);
  const echo = state.battle.minions![0]!;
  echo.combat = { ...freshCombat(), burn: 10, controlled: "freeze", controlTurns: 1 };
  echo.combat.statusSources.burn = state.team[0]!.id;
  state.talents = ["freeze.thaw-dividend"];
  for (const enemy of state.battle.enemies) {
    enemy.combat = { ...freshCombat(), controlled: "freeze", controlTurns: 2 };
  }
  const events: GameEvent[] = [];
  finishTurn(state, events);
  expect(echo.health).toBe(0);
  expect(echo.combat.controlled).toBe("freeze");
  expect(
    events.some((event) => event.kind === "status" && event.targetId === echo.id && event.outcome === "skip"),
  ).toBe(false);
});
