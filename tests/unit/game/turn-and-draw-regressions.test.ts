import { expect, it } from "vitest";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import { BATTLE_FINISH_PRIORITY } from "../../../src/application/battle-benefits";
import { drawHasAnotherCard, drawKeyword, drawOwner, journeyReturn } from "../../../src/game/card-zones";
import { healingBenefit } from "../../../src/game/ability-facts";
import { freshCombat, restoreHealth } from "../../../src/game/combat";
import { summonEcho } from "../../../src/game/combat/legendary";
import { finishTurn } from "../../../src/game/combat/turns";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { cardKeywords } from "../../../src/game/progression";
import { observeDecisions } from "../../../src/game/random";
import { requireBattle, teamRun } from "../../support/game";
import { setHand } from "../../support/cards";
import type { GameEvent } from "../../../src/game/types";

it("prioritizes a finishing Light attack through Blind with Vow Candle", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["prismram", "mossguard"])));
  const actor = state.team[0]!;
  const enemy = state.battle.enemies[0]!;
  state.boons = ["vow-candle"];
  actor.combat!.blind = true;
  enemy.health = 1;
  enemy.block = 0;
  enemy.combat = freshCombat();
  for (const other of state.battle.enemies.slice(1)) other.health = 0;
  setHand(state, ["prismram-spectrum-lance", "prismram-attack"]);
  const choices = rankedBattleChoices(state, false);
  const light = choices.find(
    (choice) => choice.command.type === "play" && choice.command.cardId === state.battle.hand[0],
  );
  const physical = choices.find(
    (choice) => choice.command.type === "play" && choice.command.cardId === state.battle.hand[1],
  );
  expect(light!.score).toBeGreaterThanOrEqual(BATTLE_FINISH_PRIORITY);
  expect(physical!.score).toBeLessThan(BATTLE_FINISH_PRIORITY);
  expect(choices[0]!.command).toEqual(light!.command);
});

it("Auto-play and Overflow Cup select the same injured ally for excess healing", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  const [healer, recipient] = state.team;
  state.boons = ["overflow-cup"];
  recipient!.health -= 10;
  setHand(state, ["mossguard-heal"]);
  const before = recipient!.health;
  expect(healingBenefit(state, healer!, 8, undefined).restored).toBe(4);
  expect(rankedBattleChoices(state, false)[0]?.command).toMatchObject({
    type: "play",
    cardId: state.battle.hand[0],
  });
  restoreHealth(healer!, 8, [], false, state);
  expect(recipient!.health - before).toBe(4);
});

it("does not count the same missing Health twice when Overflow Cup precedes Last Threshold", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram"])));
  const [healer, recipient] = state.team;
  state.boons = ["overflow-cup", "last-threshold", "clover-measuring-scoop"];
  recipient!.health -= 4;
  recipient!.combat!.grace = 2;
  recipient!.combat!.poison = 1;
  const original = structuredClone(state);
  const benefit = healingBenefit(state, healer!, 8, undefined);
  expect(state).toEqual(original);
  restoreHealth(healer!, 8, [], false, state);
  expect(benefit.restored).toBe(4);
  expect(recipient!.health - original.team[1]!.health).toBe(benefit.restored);

  const reordered = requireBattle(structuredClone(teamRun(42, ["mossguard", "prismram", "emberback"])));
  reordered.boons = state.boons;
  const [source, first, second] = reordered.team;
  first!.health = 15;
  first!.combat!.grace = 2;
  second!.health = 18;
  second!.combat!.grace = 2;
  second!.combat!.poison = 1;
  const prior = reordered.team.map((unit) => unit.health);
  const forecast = healingBenefit(reordered, source!, 8, undefined).restored;
  restoreHealth(source!, 8, [], false, reordered);
  expect(reordered.team.map((unit, index) => unit.health - prior[index]!)).toEqual([0, 4, 10]);
  expect(forecast).toBe(14);
});

it("filtered draws retain pile order and hidden decisions across owners, keywords and Journey Loom", () => {
  for (const method of ["owner", "keyword", "loom"] as const) {
    const state = requireBattle(structuredClone(teamRun(42, ["mossguard", "emberback"])));
    const [owner, other] = state.team;
    const chosen = state.cards.find(
      (card) => card.ownerId === other!.id && cardKeywords(card).includes("burn"),
    )!;
    const skipped = state.cards.find((card) => card.ownerId === owner!.id)!;
    state.boons = ["journey-loom"];
    state.battle.hand = [];
    state.battle.buffer = [];
    state.battle.draw = [chosen.id, skipped.id];
    state.battle.discard = [];
    const decisions: unknown[] = [];
    observeDecisions(state, (decision) => {
      decisions.push(decision);
      return 0;
    });
    if (method === "keyword") {
      const before = structuredClone(state);
      expect(drawHasAnotherCard(state, { kind: "drawKeyword", keyword: "burn", amount: 1 })).toBe(true);
      expect(state).toEqual(before);
      expect(decisions).toEqual([]);
    }
    if (method === "owner") expect(drawOwner(state, other!.id, [])).toBe(true);
    else if (method === "keyword") drawKeyword(state, "burn");
    else journeyReturn(state, owner!.id, []);
    expect(state.battle.hand).toEqual([chosen.id]);
    expect(state.battle.draw).toEqual([skipped.id]);
    expect(decisions).toEqual([undefined]);
    if (method === "keyword")
      expect(drawHasAnotherCard(state, { kind: "drawKeyword", keyword: "burn", amount: 1 })).toBe(false);
  }
});

it("does not value buffered promotion as a new draw for Auto-play", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["stillara", "mossguard", "prismram"])));
  const card = state.cards.find((entry) => entry.definitionId === "stillara-thaw-path")!;
  const others = state.cards.filter((entry) => entry.id !== card.id);
  state.battle.hand = [card.id, ...others.slice(0, 5).map((entry) => entry.id)];
  state.battle.buffer = others.slice(5).map((entry) => entry.id);
  state.battle.draw = [];
  state.battle.discard = [];
  expect(decodeSave(encodeSave(state))).toEqual(state);
  expect(drawHasAnotherCard(state, { kind: "draw", amount: 1 })).toBe(false);
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

it("Journey Loom and Auto-play agree on living owners and the draw pool", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["cadenza", "mossguard", "prismram"])));
  const card = state.cards.find((entry) => entry.definitionId === "cadenza-echoes-remember")!;
  const own = state.cards.find((entry) => entry.ownerId === card.ownerId && entry.id !== card.id)!;
  const fallen = state.cards.find((entry) => entry.ownerId === state.team[1]!.id)!;
  const living = state.cards.find((entry) => entry.ownerId === state.team[2]!.id)!;
  state.team[1]!.health = 0;
  state.boons = ["journey-loom"];
  state.battle.hand = [card.id, living.id];
  state.battle.buffer = [];
  state.battle.draw = [own.id, fallen.id];
  state.battle.discard = [];
  const hasChoice = () =>
    rankedBattleChoices(state, false).some(
      (choice) => choice.command.type === "play" && choice.command.cardId === card.id,
    );
  expect(hasChoice()).toBe(false);
  const before = structuredClone(state);
  journeyReturn(state, card.ownerId, []);
  expect(state).toEqual(before);

  state.battle.hand = [card.id];
  state.battle.draw.push(living.id);
  expect(hasChoice()).toBe(true);
  const result = dispatch(state, { type: "play", cardId: card.id, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.hand).toContain(living.id);
  expect(result.state.battle!.draw).toEqual([own.id, fallen.id]);
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
