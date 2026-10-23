import { produce } from "immer";
import { expect, it } from "vitest";
import { CARDS, definition, species, type SpeciesId } from "../../../../src/game/content";
import { cardText } from "../../../../src/game/card-rules";
import { freshCombat, hit, tickStatuses } from "../../../../src/game/combat";
import { dispatch, previewCard } from "../../../../src/game/engine";
import { COMBAT_PACKS, encounterSource } from "../../../../src/game/encounters";
import { definitionKeywords } from "../../../../src/game/keywords";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import type { GameEvent } from "../../../../src/game/types";
import { authoredPack, prepareDestination, accept, teamRun, winBattle } from "../../../support/game";

function ready(kinds: SpeciesId[] = ["captoad"], cardId = "captoad-swap") {
  return produce(teamRun(1, kinds), (game) => {
    const card = game.cards.find((card) => card.definitionId === cardId)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    game.rng = 1;
  });
}
function withBackup() {
  return produce(ready(["captoad", "emberback", "prismram"]), (game) => {
    game.roster.push("mossguard");
    game.reserves.push({
      id: "backup",
      species: "mossguard",
      health: 17,
      block: 4,
      attacked: true,
      combat: freshCombat(),
    });
  });
}
function play(game: ReturnType<typeof ready>) {
  return dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
}

it("guards and heals only Captoad for one Mana, using card healing and preview parity", () => {
  const game = produce(ready(["captoad", "mossguard"], "captoad-guard"), (draft) => {
    draft.team[0]!.health = 26;
    draft.team[1]!.health = 20;
  });
  const result = play(game);
  expect(result.accepted).toBe(true);
  expect(result.state.team.map((unit) => [unit.health, unit.block])).toEqual([
    [29, 3],
    [20, 0],
  ]);
  expect(result.state.battleXP).toMatchObject({ block: 1, health: 1 });
  expect(result.state.battle!.mana).toBe(3);
  expect(previewCard(game, game.battle!.hand[0]!).state).toEqual(result.state);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  expect(cardText(definition("captoad-guard"))).toBe("Gain 3 Block; Restore 3 Health");
  expect(definitionKeywords(definition("captoad-guard"))).toEqual(["block", "health"]);
  expect(cardText(definition("captoad-swap"))).toBe("Swap out for a random backup; Draw 2 cards");
  const wrongTarget = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, targetId: "ally-1" });
  expect(wrongTarget.accepted).toBe(false);
  expect(wrongTarget.state).toBe(game);
});

it("Puffs Poison onto every living enemy, excluding knockouts", () => {
  const game = produce(ready(["captoad"], "captoad-attack"), (draft) => {
    draft.encounter = 1;
    draft.journey!.victories = draft.encounter;
    prepareDestination(draft);
  });
  const started = produce(accept(game, { type: "beginBattle" }), (draft) => {
    const card = draft.cards.find((card) => card.definitionId === "captoad-attack")!;
    draft.battle!.hand = [card.id];
    draft.battle!.draw = draft.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    draft.battle!.discard = [];
    draft.battle!.buffer = [];
    draft.battle!.enemies.forEach((enemy, index) => {
      enemy.combat.controlled = "stun";
      if (index === 2) enemy.health = 0;
    });
    draft.rng = 1;
  });
  const result = play(started);
  expect(result.events.filter((event) => event.kind === "damage").map((event) => event.targetId)).toEqual([
    "enemy-0",
    "enemy-1",
  ]);
  expect(result.state.battle!.enemies.map((enemy) => enemy.combat.poison)).toEqual([2, 2, 0]);
});

it.each([0, 10])("Sporecoat retaliates on landed attacks even with %i Block", (block) => {
  const events: GameEvent[] = [];
  const initial = ready();
  const result = produce(initial, (game) => {
    game.team[0]!.block = block;
    hit(game, game.battle!.enemies[0]!, game.team[0]!, 2, "nature", events);
  });
  expect(result.team[0]!.health).toBe(block ? 30 : 28);
  expect(result.battle!.enemies[0]!.health).toBe(initial.battle!.enemies[0]!.health - 1);
  expect(result.battle!.enemies[0]!.combat.poison).toBe(1);
  expect(result.battle!.enemies[0]!.combat.statusSources.poison).toBe("ally-0");
  expect(events.filter((event) => event.kind === "damage")).toHaveLength(2);
  expect(decodeSave(encodeSave(result))).toEqual(result);
});

it("Sporecoat ignores Dodges, ticks, derived packets and knockouts without recursive retaliation", () => {
  for (const options of [
    { origin: "periodic" as const },
    { origin: "derived" as const },
    { origin: "retaliation" as const },
  ]) {
    const result = produce(ready(), (game) => {
      hit(game, game.battle!.enemies[0]!, game.team[0]!, 2, "nature", [], options);
    });
    expect(result.battle!.enemies[0]!.combat.poison).toBe(0);
  }
  const dodged = produce(ready(), (game) => {
    game.rng = 1972;
    hit(game, game.battle!.enemies[0]!, game.team[0]!, 2, "nature", []);
  });
  expect(dodged.team[0]!.health).toBe(30);
  expect(dodged.battle!.enemies[0]!.combat.poison).toBe(0);
  const knockedOut = produce(ready(), (game) => {
    game.team[0]!.health = 1;
    game.team[0]!.combat!.deathDoorUsed = true;
    hit(game, game.battle!.enemies[0]!, game.team[0]!, 2, "nature", []);
  });
  expect(knockedOut.team[0]!.health).toBe(0);
  expect(knockedOut.battle!.enemies[0]!.combat.poison).toBe(0);
  const events: GameEvent[] = [];
  const mirrored = produce(ready(), (game) => {
    game.battle!.enemies[0]!.species = "captoad";
    hit(game, game.battle!.enemies[0]!, game.team[0]!, 2, "nature", events);
    tickStatuses(game, game.battle!.enemies[0]!, events);
  });
  expect(mirrored.team[0]!.combat!.poison).toBe(0);
  expect(events.filter((event) => event.kind === "damage")).toHaveLength(3);
});

it("removes the outgoing kit from hand and piles before drawing the incoming kit, retaining state and resume", () => {
  const game = produce(withBackup(), (draft) => {
    const guard = draft.cards.find((card) => card.definitionId === "captoad-guard")!.id;
    const puff = draft.cards.find((card) => card.definitionId === "captoad-attack")!.id;
    draft.battle!.hand.push(guard);
    draft.battle!.discard = [
      puff,
      ...draft.cards.filter((card) => card.ownerId !== "ally-0").map((card) => card.id),
    ];
    draft.battle!.draw = [];
  });
  const result = play(game);
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]).toEqual(game.reserves[0]);
  expect(result.state.reserves[0]).toEqual(
    produce(game.team[0], (actor) => {
      actor!.combat!.cardsPlayedThisTurn = 1;
    }),
  );
  expect(result.state.lineup).toEqual(result.state.team.map((unit) => unit.id));
  expect(
    result.state.cards
      .filter((card) => card.ownerId === "backup")
      .every((card) => card.ownerId === "backup" && definition(card.definitionId).species === "mossguard"),
  ).toBe(true);
  expect(result.state.battle!.hand).toHaveLength(2);
  expect(result.state.battle!.draw).toHaveLength(1);
  expect(result.state.battle!.discard).toHaveLength(6);
  expect(
    result.state.battle!.hand.every(
      (id) => result.state.cards.find((card) => card.id === id)!.ownerId === "backup",
    ),
  ).toBe(true);
  expect(result.state.battle!.buffer).toEqual([]);
  expect(result.state.battle!.enemies.every((enemy) => enemy.targetId !== "ally-0")).toBe(true);
  expect(result.state.battle!.mana).toBe(3);
  const preview = previewCard(game, game.battle!.hand[0]!);
  expect(preview.state).toEqual(result.state);
  expect(preview.events).toEqual(result.events);
  expect(game.team[0]!.species).toBe("captoad");
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

it("removes outgoing overflow too, while preserving unrelated cards and filling their vacant hand slots", () => {
  const game = produce(ready(["captoad", "emberback", "prismram"]), (draft) => {
    draft.roster.push("mossguard");
    draft.reserves.push({
      id: "backup",
      species: "mossguard",
      health: 32,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    });
    const others = draft.cards.filter((card) => card.ownerId !== "ally-0").map((card) => card.id);
    const captoad = draft.cards.filter((card) => card.ownerId === "ally-0").map((card) => card.id);
    draft.battle!.hand = [
      draft.cards.find((card) => card.definitionId === "captoad-swap")!.id,
      ...others.slice(0, 5),
    ];
    draft.battle!.buffer = [...others.slice(5), ...captoad.filter((id) => !draft.battle!.hand.includes(id))];
    draft.battle!.draw = [];
  });
  const result = play(game).state;
  expect(result.battle!.hand.slice(0, 5)).toEqual(game.battle!.hand.slice(1));
  expect(result.battle!.hand).toHaveLength(6);
  expect(result.battle!.buffer).toHaveLength(2);
  expect(result.battle!.draw).toHaveLength(1);
  expect(result.cards.every((card) => card.ownerId !== "ally-0")).toBe(true);
  expect(decodeSave(encodeSave(result))).toEqual(result);
});

it("chooses only living backup with seeded RNG; rejected plays consume none", () => {
  const setup = produce(withBackup(), (game) => {
    game.roster.push("emberback");
    game.reserves.push({ ...game.reserves[0]!, id: "other", species: "emberback", health: 24 });
  });
  const chosen = new Set<string>();
  for (const seed of [1, 1000]) {
    const game = produce(setup, (draft) => {
      draft.rng = seed;
    });
    const result = play(game).state;
    chosen.add(result.team[0]!.id);
    expect(previewCard(game, game.battle!.hand[0]!).state).toEqual(result);
  }
  expect(chosen.size).toBe(2);
  const dead = produce(setup, (game) => {
    game.reserves[0]!.health = 0;
  });
  expect(play(dead).state.team[0]!.id).toBe("other");
  const empty = produce(setup, (game) => {
    game.battle!.mana = 0;
  });
  expect(play(empty).state).toBe(empty);
});

it("swaps positions with a living ally when no living backup exists, or just draws when alone", () => {
  const game = ready(["captoad", "emberback"]);
  const result = play(game).state;
  expect(result.team.map((unit) => unit.id)).toEqual(["ally-1", "ally-0"]);
  expect(result.cards).toEqual(game.cards);
  expect(result.battle!.hand).toHaveLength(2);
  expect(result.lineup).toEqual(result.team.map((unit) => unit.id));
  expect(decodeSave(encodeSave(result))).toEqual(result);
  const alone = ready();
  const solo = play(alone).state;
  expect(solo.team).toEqual(
    produce(alone.team, (team) => {
      team[0]!.combat!.cardsPlayedThisTurn = 1;
    }),
  );
  expect(solo.battle!.hand).toHaveLength(2);
  expect(decodeSave(encodeSave(solo))).toEqual(solo);
});

it("enemy Leaps reorder the battlefield without extra actions, and saves retain authored enemy identities", () => {
  let found = false;
  for (let seed = 1; seed <= 20 && !found; seed++) {
    const game = accept(
      produce(teamRun(seed, ["mossguard"]), (draft) => {
        draft.encounter = 2;
        draft.journey!.victories = draft.encounter;
        prepareDestination(draft);
        draft.expedition = {
          recruit: null,
          lastRoom: null,
          pack: authoredPack(
            draft.encounter,
            COMBAT_PACKS.findIndex((pack) => pack[0] === "captoad"),
          ),
        };
      }),
      { type: "beginBattle" },
    );
    const result = dispatch(game, { type: "endTurn" });
    const actions = result.events.filter((event) => event.kind === "action" && event.actionType !== "swap");
    if (!actions.some((event) => event.text.includes("Bogbound Leap"))) continue;
    found = true;
    expect(actions).toHaveLength(3);
    const reward = winBattle(result.state);
    expect(reward.reward!.recruits).toEqual(encounterSource(game).enemies.map((enemy) => enemy.species));
    expect(decodeSave(encodeSave(reward))).toEqual(reward);
    for (const enemy of game.battle!.enemies)
      expect(actions.filter((event) => event.actorId === enemy.id)).toHaveLength(1);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  }
  expect(found).toBe(true);
  expect(CARDS.filter((card) => card.species === "captoad")).toHaveLength(3);
  expect(species("captoad").passiveTiers.map((tier) => tier.effects[0]!.amount)).toEqual([1, 2, 3, 4, 5, 6]);
});

it.each([1, 2, 3, 4, 5, 6])(
  "Sporecoat retaliates for %i Poison damage at its collected tier while enemies stay at base",
  (copies) => {
    const result = produce(ready(), (game) => {
      game.discovery.recruited.captoad = copies;
      hit(game, game.battle!.enemies[0]!, game.team[0]!, 2, "nature", []);
    });
    expect(result.battle!.enemies[0]!.health).toBe(result.battle!.enemies[0]!.maxHealth - copies);
    expect(result.battle!.enemies[0]!.combat.poison).toBe(copies);
    expect(decodeSave(encodeSave(result))).toEqual(result);
    const enemyResult = produce(ready(), (game) => {
      game.discovery.recruited.captoad = copies;
      game.battle!.enemies[0]!.species = "captoad";
      game.battle!.enemies[0]!.combat = freshCombat();
      hit(game, game.team[0]!, game.battle!.enemies[0]!, 2, "nature", []);
    });
    expect(enemyResult.team[0]!.health).toBe(29);
    expect(enemyResult.team[0]!.combat!.poison).toBe(1);
  },
);
