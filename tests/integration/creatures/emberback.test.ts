import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, cardText, definition } from "../../../src/game/content";
import { validateCatalog, contentCatalog } from "../../../src/game/content-validation";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { freshCombat } from "../../../src/game/combat/index";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { battleChoices } from "../../../src/application/battle-policy";
import { accept, teamRun, winBattle } from "../../support/game";

function ready(definitionId: string) {
  return produce(teamRun(1, ["emberback", "mossguard", "prismram"]), (game) => {
    game.rng = 1;
    const card = game.cards.find((card) => card.definitionId === definitionId)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    game.battle!.enemies.forEach((enemy) => {
      enemy.health = enemy.maxHealth;
      enemy.block = 0;
      enemy.combat = freshCombat();
      // Controlled targets cannot Dodge.
      enemy.combat.controlled = "freeze";
      enemy.combat.controlTurns = 1;
    });
  });
}

it("charges one target, grants the acting creature Armor, and preserves the result across resume", () => {
  const game = ready("emberback-attack");
  const result = dispatch(game, {
    type: "play",
    cardId: game.battle!.hand[0]!,
    targetId: "enemy-0",
    autoEndTurn: false,
  });
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.combat!.armor).toBe(2);
  expect(result.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
    game.battle!.enemies.map((enemy, index) => enemy.health - (index === 0 ? 4 : 0)),
  );
  expect(result.state.battle!.mana).toBe(game.battle!.mana - 1);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  expect(cardText(definition("emberback-attack"))).toBe("Deal 4 Physical damage; Gain 2 Armor");
  const rejected = dispatch(game, { type: "play", cardId: game.battle!.hand[0]! });
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(game);
});

it.each([
  ["emberback-furnace-breath", "burn", "Burn"],
  ["emberback-magma-stomp", "stun", "Stun"],
] as const)(
  "resolves %s across living enemies once for one Mana and previews the same outcome",
  (id, status, label) => {
    const game = produce(ready(id), (draft) => {
      draft.battle!.enemies[1]!.health = 0;
      draft.battle!.enemies[0]!.combat = freshCombat();
      draft.battle!.enemies[2]!.combat = freshCombat();
    });
    const original = encodeSave(game);
    const cardId = game.battle!.hand[0]!;
    const preview = previewCard(game, cardId);
    const result = dispatch(game, { type: "play", cardId, autoEndTurn: false });
    expect(preview.accepted).toBe(true);
    expect(result.accepted).toBe(true);
    expect(encodeSave(game)).toBe(original);
    expect(preview.state.battle!.enemies).toEqual(result.state.battle!.enemies);
    expect(preview.events).toEqual(result.events);
    expect(result.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
      game.battle!.enemies.map((enemy) => Math.max(0, enemy.health - 2)),
    );
    expect(result.state.battle!.enemies.map((enemy) => enemy.combat[status])).toEqual([2, 0, 2]);
    expect(result.state.team.map((ally) => ally.health)).toEqual(game.team.map((ally) => ally.health));
    expect(result.state.battle!.mana).toBe(game.battle!.mana - 1);
    expect(result.state.battle!.cardsPlayedThisTurn).toBe(1);
    expect(result.state.battleXP[status]).toBe(1);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(cardText(definition(id))).toBe(`Deal 2 ${label} damage to all enemies`);
    expect(battleChoices(game, false)[0]).toEqual({
      type: "play",
      cardId,
      targetId: undefined,
      autoEndTurn: false,
    });
  },
);

it("settles an area victory after every opponent is hit and stops when retaliation knocks out the actor", () => {
  const game = produce(ready("emberback-furnace-breath"), (draft) => {
    draft.battle!.enemies.forEach((enemy) => {
      enemy.health = 1;
    });
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]! });
  expect(result.accepted).toBe(true);
  expect(result.state.phase).toBe("recruit");
  expect(result.events.filter((event) => event.kind === "damage" && event.actorId === "ally-0")).toHaveLength(
    3,
  );
  expect(result.state.reward!.recruits).toHaveLength(3);
  const retaliation = produce(ready("emberback-furnace-breath"), (draft) => {
    draft.team[0]!.health = 1;
    draft.team[0]!.combat!.deathDoorUsed = true;
    draft.battle!.enemies[0]!.combat.thorns = 2;
  });
  const stopped = dispatch(retaliation, {
    type: "play",
    cardId: retaliation.battle!.hand[0]!,
    autoEndTurn: false,
  });
  expect(stopped.accepted).toBe(true);
  expect(stopped.state.team[0]!.health).toBe(0);
  expect(stopped.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
    retaliation.battle!.enemies.map((enemy, index) => enemy.health - (index === 0 ? 2 : 0)),
  );
});

it("discovers and recruits Emberback from an ordinary encounter and resumes its three-card kit", () => {
  const initial = createGame(7);
  let game = accept(accept(initial, { type: "draft", species: initial.starterOffers[0]! }), {
    type: "start",
  });
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = COMBAT_PACKS.findIndex((pack) => pack[0] === "emberback");
    }),
    { type: "beginBattle" },
  );
  expect(game.discovery.encountered).toContain("emberback");
  expect(game.battle!.enemies[0]!.combat.armor).toBe(0);
  game = winBattle(game);
  game = accept(game, { type: "recruit", species: "emberback" });
  expect(game.discovery.recruited.emberback).toBe(1);
  expect(game.cards.filter((card) => card.ownerId === game.team[1]!.id)).toHaveLength(3);
  expect(decodeSave(encodeSave(game))).toEqual(game);
});

it("keeps every authored ability at one Mana and validates the catalog", () => {
  expect(CARDS.every((card) => card.cost === 1)).toBe(true);
  expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  const cards = CARDS.map((card, index) => (index === 0 ? { ...card, cost: 2 } : card));
  expect(validateCatalog({ ...contentCatalog, cards } as typeof contentCatalog)).toContainEqual(
    expect.objectContaining({ field: "cost", severity: "error" }),
  );
});

it("uses an enemy area ability against deployed allies while leaving reserves untouched", () => {
  let game = accept(
    produce(teamRun(1, ["mossguard", "emberback", "prismram"]), (draft) => {
      draft.phase = "teamSelection";
      draft.battle = null;
      draft.encounter = 2;
      draft.expedition = {
        recruit: null,
        lastRoom: null,
        pack: COMBAT_PACKS.findIndex((pack) => pack[0] === "emberback"),
      };
      draft.roster.push("mossguard");
      draft.reserves.push({ ...draft.team[0]!, id: "reserve", combat: freshCombat() });
    }),
    { type: "beginBattle" },
  );
  game = produce(game, (draft) => {
    draft.rng = 1;
    draft.battle!.enemies[0]!.lastAbility = "emberback-attack";
    draft.battle!.enemies.slice(1).forEach((enemy) => {
      enemy.health = 0;
    });
    draft.team.forEach((ally) => {
      ally.combat!.controlled = "freeze";
      ally.combat!.controlTurns = 1;
    });
  });
  const result = dispatch(game, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  const first = result.events.findIndex((event) => event.kind === "action");
  const next = result.events.findIndex((event, index) => index > first && event.kind === "action");
  const packets = result.events
    .slice(first, next < 0 ? undefined : next)
    .filter((event) => event.kind === "damage" && event.actorId === "enemy-0" && !event.periodic);
  expect(packets.map((event) => event.targetId)).toEqual(game.team.map((ally) => ally.id));
  expect(packets.every((event) => event.amount === 2)).toBe(true);
  expect(result.state.reserves).toEqual(game.reserves);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

it("checks Dodge and defenses separately for every area recipient", () => {
  const game = produce(ready("emberback-furnace-breath"), (draft) => {
    const enemies = draft.battle!.enemies;
    enemies[0]!.combat = freshCombat();
    enemies[0]!.combat.dodge = 70;
    enemies[1]!.block = 1;
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(
    result.state.battle!.enemies.map((enemy, index) => game.battle!.enemies[index]!.health - enemy.health),
  ).toEqual([0, 1, 2]);
  expect(result.state.battle!.enemies.map((enemy) => enemy.combat.burn)).toEqual([0, 1, 2]);
  expect(result.state.battle!.enemies[1]!.block).toBe(0);
});
