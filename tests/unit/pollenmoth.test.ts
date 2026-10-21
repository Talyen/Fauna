import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, cardText, species } from "../../src/game/content";
import { freshCombat, hit, restoreHealth } from "../../src/game/combat";
import { createGame, dispatch, previewCard } from "../../src/game/engine";
import { COMBAT_PACKS } from "../../src/game/encounters";
import { decodeSave, encodeSave } from "../../src/game/save";
import { validateCatalog } from "../../src/game/content-validation";
import { battleChoices } from "../../src/application/battle-policy";
import type { GameEvent } from "../../src/game/types";
import { accept, teamRun, winBattle } from "./helpers";

function ready(id: string, copies = 1) {
  return produce(teamRun(1, ["pollenmoth", "mossguard", "prismram"]), (game) => {
    game.discovery.recruited.pollenmoth = copies;
    const card = game.cards.find((card) => card.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    game.battle!.enemies.forEach((enemy) => {
      enemy.health = enemy.maxHealth;
      enemy.block = 0;
      enemy.combat = freshCombat();
      enemy.combat.controlled = "freeze";
      enemy.combat.controlTurns = 1;
    });
  });
}

it("authors the agreed kit and six complete passive tiers", () => {
  const cards = CARDS.filter((card) => card.species === "pollenmoth");
  expect(cards.map((card) => [card.cost, cardText(card)])).toEqual([
    [1, "Deal 3 Light damage to a random enemy"],
    [1, "Allies gain 2 Block"],
    [1, "Restore 3 Health to the most injured ally"],
  ]);
  expect(species("pollenmoth").passiveTiers.map((tier) => tier?.description)).toEqual([
    "Light damage bounces once",
    "Light damage bounces once, with a 50% chance to bounce twice",
    "Light damage bounces twice",
    "Light damage bounces twice; Health restoration has a 50% chance to bounce once",
    "Light damage bounces twice; Health restoration bounces once, with a 50% chance to bounce twice",
    "Light damage and Health restoration bounce twice",
  ]);
  expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
});

it.each([1, 2, 3, 4, 5, 6])("resolves tier %i damage bounces without revisits or recursion", (copies) => {
  const game = ready("pollenmoth-attack", copies);
  const events: GameEvent[] = [];
  const next = produce(game, (draft) => {
    draft.rng = 1;
    hit(draft, draft.team[0]!, draft.battle!.enemies[0]!, 3, "light", events);
  });
  const damage = events.filter((event) => event.kind === "damage");
  expect(damage.length).toBe(copies === 1 ? 2 : copies === 2 ? 2 : 3);
  expect(new Set(damage.map((event) => event.targetId)).size).toBe(damage.length);
  expect(damage.every((event) => event.amount === 3)).toBe(true);
  expect(decodeSave(encodeSave(next))).toEqual(next);
});

it.each([1, 2, 3, 4, 5, 6])("resolves tier %i healing bounces including self", (copies) => {
  const game = produce(ready("pollenmoth-heal", copies), (draft) => {
    draft.rng = 1;
    draft.team.forEach((ally, index) => {
      ally.health = index + 1;
    });
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  const heals = result.events.filter((event) => event.kind === "heal");
  expect(heals.length).toBe(copies < 4 ? 1 : copies === 4 ? 2 : 3);
  expect(heals[0]!.targetId).toBe("ally-0");
  expect(new Set(heals.map((event) => event.targetId)).size).toBe(heals.length);
  expect(heals.every((event) => event.amount === 3)).toBe(true);
});

it("uses seeded random targets and gives identical previews without consuming live RNG", () => {
  const game = ready("pollenmoth-attack");
  const before = encodeSave(game);
  const cardId = game.battle!.hand[0]!;
  const preview = previewCard(game, cardId);
  const result = dispatch(game, { type: "play", cardId, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(preview.events).toEqual(result.events);
  expect(preview.state.battle!.enemies).toEqual(result.state.battle!.enemies);
  expect(encodeSave(game)).toBe(before);
  expect(result.state.battle!.mana).toBe(game.battle!.mana - 1);
  expect(battleChoices(game, false)[0]).toEqual({ type: "play", cardId, autoEndTurn: false });
  const rejected = dispatch(
    produce(game, (draft) => {
      draft.battle!.mana = 0;
    }),
    { type: "play", cardId },
  );
  expect(rejected.accepted).toBe(false);
  expect(rejected.state.rng).toBe(game.rng);
});

it("protects living deployed allies and never reserves or knockouts", () => {
  const game = produce(ready("pollenmoth-teamGuard"), (draft) => {
    draft.team[2]!.health = 0;
    draft.reserves.push({ ...draft.team[1]!, id: "reserve" });
    draft.roster.push("mossguard");
  });
  const next = accept(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(next.team.map((ally) => ally.block)).toEqual(
    game.team.map((ally, index) => ally.block + (index < 2 ? 2 : 0)),
  );
  expect(next.reserves).toEqual(game.reserves);
});

it("does not bounce healing to healthy allies or consume RNG without eligible recipients", () => {
  const game = produce(ready("pollenmoth-heal", 6), (draft) => {
    draft.team[0]!.health -= 1;
  });
  const events: GameEvent[] = [];
  const next = produce(game, (draft) => {
    restoreHealth(draft.team[0]!, 3, events, false, draft, true, draft.team[0]!);
  });
  expect(events.filter((event) => event.kind === "heal")).toHaveLength(1);
  expect(next.rng).toBe(game.rng);
});

it("honors the probabilistic healing tier and stops damage bounces after actor knockout", () => {
  const game = produce(ready("pollenmoth-heal", 4), (draft) => {
    draft.rng = 1000;
    draft.team.forEach((ally) => {
      ally.health = 5;
    });
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.events.filter((event) => event.kind === "heal")).toHaveLength(1);
  const events: GameEvent[] = [];
  produce(ready("pollenmoth-attack", 6), (draft) => {
    draft.team[0]!.health = 1;
    draft.team[0]!.combat!.deathDoorUsed = true;
    draft.battle!.enemies[0]!.combat.thorns = 2;
    draft.rng = 1;
    hit(draft, draft.team[0]!, draft.battle!.enemies[0]!, 3, "light", events);
  });
  expect(events.filter((event) => event.kind === "damage" && event.actorId === "ally-0")).toHaveLength(1);
});

it("discovers and recruits Pollenmoth with its complete kit", () => {
  const initial = createGame(7);
  let game = accept(accept(initial, { type: "draft", species: initial.starterOffers[0]! }), {
    type: "start",
  });
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = COMBAT_PACKS.findIndex((pack) => pack[0] === "pollenmoth");
    }),
    { type: "beginBattle" },
  );
  expect(game.discovery.encountered).toContain("pollenmoth");
  game = accept(winBattle(game), { type: "recruit", species: "pollenmoth" });
  expect(game.discovery.recruited.pollenmoth).toBe(1);
  expect(game.cards.filter((card) => card.ownerId === game.team[1]!.id)).toHaveLength(3);
  expect(decodeSave(encodeSave(game))).toEqual(game);
});

it.each([
  [9, 3],
  [1000, 2],
])("uses seeded chance for the second damage bounce (seed %i)", (seed, count) => {
  const events: GameEvent[] = [];
  produce(ready("pollenmoth-attack", 2), (draft) => {
    draft.rng = seed;
    hit(draft, draft.team[0]!, draft.battle!.enemies[0]!, 3, "light", events);
  });
  expect(events.filter((event) => event.kind === "damage")).toHaveLength(count);
});

it("uses the enemy's base bounce tier against allies regardless of collected stars", () => {
  const initial = createGame(7);
  let game = accept(accept(initial, { type: "draft", species: initial.starterOffers[0]! }), {
    type: "start",
  });
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = COMBAT_PACKS.findIndex((pack) => pack[0] === "pollenmoth");
      draft.encounter = 2;
    }),
    { type: "beginBattle" },
  );
  const events: GameEvent[] = [];
  produce(game, (draft) => {
    draft.discovery.recruited.pollenmoth = 6;
    const enemy = draft.battle!.enemies[0]!;
    // A second deployed creature makes the enemy's guaranteed bounce observable.
    draft.team.push({ ...draft.team[0]!, id: "ally-extra", combat: freshCombat() });
    draft.team.forEach((ally) => {
      ally.combat!.controlled = "freeze";
      ally.combat!.controlTurns = 1;
    });
    hit(draft, enemy, draft.team[0]!, 1, "light", events);
  });
  expect(events.filter((event) => event.kind === "damage" && event.actorId === "enemy-0")).toHaveLength(2);
});
