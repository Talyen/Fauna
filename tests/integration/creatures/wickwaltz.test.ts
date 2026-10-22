import { swapFixture } from "../../support/game";
import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, FIRST_RUN_STARTERS } from "../../../src/game/content";
import { cardText } from "../../../src/game/card-rules";
import { freshCombat, hit, removeEffects } from "../../../src/game/combat/index";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { definitionKeywords } from "../../../src/game/keywords";
import { combatStatuses } from "../../../src/ui/shared/combat/combat-status";
import type { GameEvent, GameState } from "../../../src/game/types";
import { prepareDestination, accept, teamRun } from "../../support/game";

function ready(copies = 6) {
  return produce(teamRun(1, ["wickwaltz", "mossguard", "prismram"]), (game) => {
    game.discovery.recruited.wickwaltz = copies;
    game.battle!.hand = game.cards.filter((card) => card.ownerId === "ally-0").map((card) => card.id);
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((card) => card.ownerId !== "ally-0").map((card) => card.id);
    for (const enemy of game.battle!.enemies) {
      enemy.block = 0;
      enemy.combat = freshCombat();
    }
    game.rng = 0;
  });
}
function play(game: GameState, definitionId: string) {
  return dispatch(game, {
    type: "play",
    cardId: game.cards.find((card) => card.definitionId === definitionId)!.id,
    autoEndTurn: false,
  });
}
const repeats = (events: GameEvent[]) =>
  events.filter((event) => event.text.includes("with Kindling Flourish"));

it("adds the approved three-card kit to drafts, encounters and current-format saves", () => {
  const kit = CARDS.filter((card) => card.species === "wickwaltz");
  expect(kit.map((card) => [card.cost, cardText(card)])).toEqual([
    [1, "Deal 2 Burn damage to all enemies"],
    [1, "Gain 3 Block; Nullify the next Freeze damage"],
    [1, "Draw 2 cards; Gain 1 Mana"],
  ]);
  expect(kit.map(definitionKeywords)).toEqual([["burn"], ["block"], ["mana"]]);
  expect(FIRST_RUN_STARTERS).toContain("wickwaltz");
  expect(COMBAT_PACKS.some((pack) => pack.some((kind) => kind === "wickwaltz"))).toBe(true);
  for (const card of kit) {
    const game = ready();
    const before = encodeSave(game);
    const result = play(game, card.id);
    expect(result.accepted).toBe(true);
    expect(previewCard(game, game.cards.find((entry) => entry.definitionId === card.id)!.id)).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(repeats(result.events)).toHaveLength(0);
    if (card.effect === "attack") {
      expect(result.events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([
        2, 2, 2,
      ]);
      expect(result.state.battle!.enemies[0]!.combat.burn).toBe(2);
    } else if (card.effect === "guard") {
      expect(result.state.team[0]!.block).toBe(3);
      expect(result.state.team[0]!.combat!.nullifyFreeze).toBe(true);
      expect(combatStatuses(result.state.team[0]!.combat)).toContainEqual(
        expect.objectContaining({ id: "nullifyFreeze", count: 1 }),
      );
    } else {
      expect(result.state.battle!.mana).toBe(4);
      expect(result.state.battle!.hand).toHaveLength(4);
    }
  }
  expect(() => decodeSave(JSON.stringify({ ...ready(), version: 37 }))).toThrow();
});

it.each([20, 36, 52, 68, 84, 100])("repeats only the second accepted card at %i percent", (chance) => {
  for (const rollAbove of [false, true]) {
    if (chance === 100 && rollAbove) continue;
    let seed = 0;
    while (true) {
      const roll = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
      if (
        rollAbove
          ? roll >= chance / 100 && roll < chance / 100 + 0.001
          : roll >= chance / 100 - 0.001 && roll < chance / 100
      )
        break;
      seed++;
    }
    const copies = [20, 36, 52, 68, 84, 100].indexOf(chance) + 1;
    let game = play(ready(copies), "wickwaltz-guard").state;
    game = produce(game, (draft) => {
      draft.rng = seed;
    });
    const result = play(game, "wickwaltz-draw");
    const repeated = !rollAbove;
    expect(repeats(result.events)).toHaveLength(repeated ? 1 : 0);
    expect(result.state.battle!.mana).toBe(repeated ? 4 : 3);
    expect(result.state.battle!.hand).toHaveLength(repeated ? 5 : 3);
    expect(result.state.battleXP.mana).toBe(1);
    expect(result.state.battle!.cardsPlayedThisTurn).toBe(2);
    expect(result.state.team[0]!.combat!.cardsPlayedThisTurn).toBe(2);
    expect(previewCard(game, game.cards.find((card) => card.definitionId === "wickwaltz-draw")!.id)).toEqual(
      result,
    );
    expect(repeats(play(result.state, "wickwaltz-attack").events)).toHaveLength(0);
  }
});

it("repeats the whole second attack across all living enemies for one cost and XP award", () => {
  let game = play(ready(), "wickwaltz-guard").state;
  const result = play(game, "wickwaltz-attack");
  expect(repeats(result.events)).toHaveLength(1);
  expect(result.events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([
    2, 2, 2, 2, 2, 2,
  ]);
  expect(result.state.battle!.enemies[0]!.combat.burn).toBe(4);
  expect(result.state.battle!.mana).toBe(2);
  expect(result.state.battleXP.burn).toBe(1);
  game = produce(game, (draft) => {
    draft.battle!.enemies.forEach((enemy, i) => {
      enemy.health = i === 0 ? 1 : 0;
    });
  });
  expect(play(game, "wickwaltz-attack").events.filter((event) => event.kind === "damage")).toHaveLength(1);
});

it("repeats Saffron Screen's Block without stacking Freeze wards", () => {
  const game = play(ready(), "wickwaltz-draw").state;
  const result = play(game, "wickwaltz-guard");
  expect(result.state.team[0]!.block).toBe(6);
  expect(result.state.team[0]!.combat!.nullifyFreeze).toBe(true);
  expect(result.state.battleXP.block).toBe(1);
});

it("does not count teammate plays or rejected commands and retains the count across swaps and resume", () => {
  let game = produce(ready(), (draft) => {
    const card = draft.cards.find((card) => card.definitionId === "mossguard-guard")!;
    draft.battle!.draw = draft.battle!.draw.filter((id) => id !== card.id);
    draft.battle!.hand.push(card.id);
    const backup = { ...draft.team[1]!, id: "backup", combat: freshCombat() };
    draft.reserves.push(backup);
    draft.roster.push(backup.species);
  });
  game = play(game, "mossguard-guard").state;
  expect(repeats(play(game, "wickwaltz-guard").events)).toHaveLength(0);
  game = play(game, "wickwaltz-guard").state;
  const rejected = play(game, "wickwaltz-guard");
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(game);
  game = swapFixture(game, { type: "swap", activeId: "ally-0", reserve: "backup" });
  game = decodeSave(encodeSave(game));
  expect(game.reserves[0]!.combat!.cardsPlayedThisTurn).toBe(1);
  expect(game.reserves[0]!.combat!.nullifyFreeze).toBe(true);
  game = swapFixture(game, { type: "swap", activeId: "backup", reserve: "ally-0" });
  const result = play(game, "wickwaltz-draw");
  expect(repeats(result.events)).toHaveLength(1);
  expect(repeats(play(decodeSave(encodeSave(result.state)), "wickwaltz-attack").events)).toHaveLength(0);
  const nextTurn = accept(result.state, { type: "endTurn" });
  expect(nextTurn.team[0]!.combat!.cardsPlayedThisTurn).toBe(0);
  const nextBattle = accept(
    produce(result.state, (draft) => {
      prepareDestination(draft);
    }),
    { type: "beginBattle" },
  );
  expect(nextBattle.team[0]!.combat!.cardsPlayedThisTurn).toBe(0);
  expect(nextBattle.team[0]!.combat!.nullifyFreeze).toBe(false);
});

it("absorbs exactly one Freeze packet before Block and buildup, preserving other defenses", () => {
  produce(play(ready(), "wickwaltz-guard").state, (game) => {
    const target = game.team[0]!,
      source = game.battle!.enemies[0]!;
    target.combat!.nullify = true;
    const events: GameEvent[] = [];
    const health = target.health;
    hit(game, source, target, 12, "freeze", events, { origin: "proc" as const });
    expect(target.health).toBe(health);
    expect(target.block).toBe(3);
    expect(target.combat!.freeze).toBe(0);
    expect(target.combat!.nullifyFreeze).toBe(false);
    expect(target.combat!.nullify).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ status: "nullify", outcome: "immune" }));
    hit(game, source, target, 5, "freeze", events, { origin: "proc" as const });
    expect(target.health).toBe(health - 2);
    expect(target.block).toBe(0);
    expect(target.combat!.nullify).toBe(false);
  });
});

it("keeps the ward on misses and other damage, allows Purge, and protects enemies too", () => {
  produce(ready(), (game) => {
    const source = game.team[0]!,
      target = game.battle!.enemies[0]!;
    target.combat.nullifyFreeze = true;
    hit(game, source, target, 3, "freeze", [], { origin: "ability" as const, blindMiss: true });
    expect(target.combat.nullifyFreeze).toBe(true);
    hit(game, source, target, 1, "light", [], { origin: "proc" as const });
    expect(target.combat.nullifyFreeze).toBe(true);
    const health = target.health;
    hit(game, source, target, 12, "freeze", [], { origin: "proc" as const });
    expect(target.health).toBe(health);
    expect(target.combat.nullifyFreeze).toBe(false);
    target.combat.nullifyFreeze = true;
    removeEffects(target, "purge", 10, [], game);
    expect(target.combat.nullifyFreeze).toBe(false);
  });
});

it("counts free cards and keeps distinct Wickwaltz copies independent", () => {
  const game = produce(teamRun(1, ["wickwaltz", "wickwaltz", "mossguard"]), (draft) => {
    draft.discovery.recruited.wickwaltz = 6;
    draft.battle!.hand = draft.cards
      .filter((card) => card.definitionId === "wickwaltz-guard")
      .map((card) => card.id);
    draft.battle!.draw = draft.cards
      .filter((card) => card.definitionId !== "wickwaltz-guard")
      .map((card) => card.id);
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.team[0]!.combat!.freeCard = true;
  });
  const first = accept(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(first.battle!.mana).toBe(4);
  const second = dispatch(first, { type: "play", cardId: first.battle!.hand[0]!, autoEndTurn: false });
  expect(second.accepted).toBe(true);
  expect(repeats(second.events)).toHaveLength(0);
  expect(second.state.team.slice(0, 2).map((unit) => unit.combat!.cardsPlayedThisTurn)).toEqual([1, 1]);
});

it("shares the two-resolution limit with other repeat sources", () => {
  let game = play(ready(), "wickwaltz-guard").state;
  game = produce(game, (draft) => {
    draft.talents.push("burn.flash-fire");
    draft.rng = 1972;
  });
  const result = play(game, "wickwaltz-attack");
  expect(repeats(result.events)).toHaveLength(1);
  expect(
    result.events.filter((event) => event.kind === "damage" && event.actorId === "ally-0").length,
  ).toBeLessThanOrEqual(6);
  expect(result.state.battleXP.burn).toBe(1);
});

it("gives enemy Wickwaltz its supported attack and ward without drawing or granting player Mana", () => {
  const game = produce(ready(), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "wickwaltz";
    enemy.name = "Wickwaltz";
    enemy.lastAbility = "wickwaltz-attack";
    for (const other of draft.battle!.enemies.slice(1)) other.health = 0;
  });
  const result = dispatch(game, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.enemies[0]!.combat.nullifyFreeze).toBe(true);
  expect(result.state.battle!.enemies[0]!.lastAbility).toBe("wickwaltz-guard");
  expect(result.events.some((event) => event.text.includes("Thermal Rise"))).toBe(false);
  expect(result.state.battle!.mana).toBe(4);
});
