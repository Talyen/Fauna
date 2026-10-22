import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, definition, species } from "../../../../src/game/content";
import { cardText } from "../../../../src/game/card-rules";
import { freshCombat, hit } from "../../../../src/game/combat";
import { createGame, dispatch, previewCard } from "../../../../src/game/engine";
import { COMBAT_PACKS } from "../../../../src/game/encounters";
import { cardKeywords } from "../../../../src/game/progression";
import { decodeSave, encodeSave } from "../../../../src/game/save";
import { accept, teamRun, winBattle } from "../../../support/game";
import type { GameEvent } from "../../../../src/game/types";

function ready(id = "cindernewt-attack", seed = 1) {
  return produce(teamRun(1, ["cindernewt", "mossguard", "dunefox"]), (game) => {
    const card = game.cards.find((card) => card.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    game.battle!.enemies.forEach((enemy) => {
      enemy.block = 0;
      enemy.combat = freshCombat();
      enemy.combat.controlled = "stun";
      enemy.combat.controlTurns = 1;
    });
    game.rng = seed;
  });
}

it("plays and resumes the one-Mana kit with deterministic previews and matching rules", () => {
  const cards = CARDS.filter((card) => card.species === "cindernewt");
  expect(cards.map((card) => [card.cost, cardText(card)])).toEqual([
    [1, "Deal 6 Physical or Burn damage at random"],
    [1, "Deal 1 Burn damage to all enemies; Remove 50% of all enemies’ Armor, rounded up"],
    [1, "Deal 1 Burn damage to all enemies; Blind all enemies"],
  ]);
  expect(cardKeywords({ definitionId: "cindernewt-attack" })).toEqual(["physical", "burn"]);
  expect(cardKeywords({ definitionId: "cindernewt-ember-breath" })).toEqual(["burn", "light"]);
  for (const card of cards) {
    const game = ready(card.id);
    const cardId = game.battle!.hand[0]!;
    const targetId = card.id === "cindernewt-attack" ? "enemy-0" : undefined;
    const result = dispatch(game, { type: "play", cardId, targetId, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(previewCard(game, cardId, targetId)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    expect(game.rng).toBe(1);
    if (card.id === "cindernewt-ashen-veil")
      expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind && enemy.combat.burn > 0)).toBe(
        true,
      );
  }
});

it.each([
  [1, "burn"],
  [1800, "physical"],
] as const)("seed %i selects only %s damage without consuming RNG on rejection", (seed, damageType) => {
  const game = ready("cindernewt-attack", seed);
  const cardId = game.battle!.hand[0]!;
  const rejected = dispatch(game, { type: "play", cardId, targetId: "missing" });
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(game);
  const result = dispatch(game, { type: "play", cardId, targetId: "enemy-0", autoEndTurn: false });
  const damage = result.events.filter((event) => event.kind === "damage");
  expect(damage).toHaveLength(1);
  expect(damage[0]).toMatchObject({ damageType, amount: 6 });
  expect(result.state.battle!.enemies[0]!.combat.burn).toBe(damageType === "burn" ? 6 : 0);
});

it.each(["cindernewt-ember-breath", "cindernewt-ashen-veil"])(
  "applies %s's group effect even after a Blind miss",
  (id) => {
    const game = produce(ready(id), (draft) => {
      draft.team[0]!.combat!.blind = true;
      draft.battle!.enemies.forEach((enemy, index) => {
        enemy.combat.armor = [5, 2, 1][index]!;
      });
    });
    const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
    expect(result.events.filter((event) => event.outcome === "dodge")).toHaveLength(3);
    expect(result.state.battle!.enemies.map((enemy) => enemy.health)).toEqual(
      game.battle!.enemies.map((enemy) => enemy.health),
    );
    if (id === "cindernewt-ember-breath") {
      expect(result.state.battle!.enemies.map((enemy) => enemy.combat.armor)).toEqual([2, 1, 0]);
      expect(result.events.filter((event) => event.status === "armor").map((event) => event.amount)).toEqual([
        3, 1, 1,
      ]);
    } else expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
  },
);

it("melting the last Armor triggers Molten Shell after damage and preserves other defenses", () => {
  const game = produce(ready("cindernewt-ember-breath"), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "emberback";
    enemy.combat.armor = 1;
    enemy.combat.thorns = 3;
    enemy.block = 10;
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.state.battle!.enemies[0]!.combat.armor).toBe(0);
  expect(result.state.battle!.enemies[0]!.combat.thorns).toBe(3);
  expect(result.state.battle!.enemies[0]!.block).toBeLessThan(10);
  expect(result.state.team.every((unit) => unit.combat!.burn === 1)).toBe(true);
});

it.each([1, 2, 3, 4, 5, 6])(
  "Cinderstep retaliates with tier %i Burn on a Blind Dodge without recursive retaliation",
  (copies) => {
    const events: GameEvent[] = [];
    produce(ready(), (game) => {
      game.discovery.recruited.cindernewt = copies;
      const target = game.team[0]!,
        source = game.battle!.enemies[0]!;
      source.species = "captoad";
      source.combat = freshCombat();
      source.combat.blind = true;
      source.combat.dodge = 70;
      source.combat.thorns = 6;
      const health = target.health;
      hit(game, source, target, 4, "physical", events);
      expect(target.health).toBe(health);
      expect(source.combat.burn).toBe(copies);
      expect(source.combat.statusSources.burn).toBe(target.id);
      expect(events.filter((event) => event.kind === "damage")).toEqual([
        expect.objectContaining({
          actorId: target.id,
          targetId: source.id,
          damageType: "burn",
          amount: copies,
          critical: false,
        }),
      ]);
    });
  },
);

it("enemy Cinderstep uses its base tier and periodic damage cannot trigger Dodge", () => {
  produce(ready(), (game) => {
    game.discovery.recruited.cindernewt = 6;
    const target = game.battle!.enemies[0]!,
      actor = game.team[0]!;
    target.species = "cindernewt";
    target.combat = freshCombat();
    actor.combat!.blind = true;
    hit(game, actor, target, 6, "physical", []);
    expect(actor.combat!.burn).toBe(1);
    const health = actor.health;
    hit(game, actor, target, 1, "burn", [], { origin: "periodic" as const });
    expect(actor.health).toBe(health);
  });
});

it("discovers, recruits and resumes Cindernewt with its full kit", () => {
  const initial = createGame(7);
  let game = accept(
    accept(initial, { type: "draft", species: initial.starterOffers.find((kind) => kind !== "cindernewt")! }),
    { type: "start" },
  );
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = COMBAT_PACKS.findIndex((pack) => pack[0] === "cindernewt");
    }),
    { type: "beginBattle" },
  );
  expect(game.discovery.encountered).toContain("cindernewt");
  game = accept(winBattle(game), { type: "recruit", species: "cindernewt" });
  expect(game.discovery.recruited.cindernewt).toBe(1);
  expect(
    game.cards
      .filter((card) => card.ownerId === game.team[1]!.id)
      .map((card) => definition(card.definitionId).species),
  ).toEqual(["cindernewt", "cindernewt", "cindernewt"]);
  expect(decodeSave(encodeSave(game))).toEqual(game);
  expect(species("cindernewt").passiveTiers).toHaveLength(6);
  expect(() => decodeSave(JSON.stringify({ ...game, version: 28 }))).toThrow();
});

it("Cinderstep also follows ordinary Dodge and retains normal Block mitigation", () => {
  produce(ready(), (game) => {
    const target = game.team[0]!,
      source = game.battle!.enemies[0]!;
    game.discovery.recruited.cindernewt = 6;
    target.combat!.dodge = 70;
    source.block = 2;
    const before = target.health;
    hit(game, source, target, 6, "physical", []);
    expect(target.health).toBe(before);
    expect(source.block).toBe(0);
    expect(source.combat.burn).toBe(4);
  });
});

it.each([
  [1, "Ember Breath", "armor"],
  [1800, "Ashen Veil", "blind"],
] as const)("enemy %s selects %s and affects deployed allies only", (seed, name, status) => {
  const game = produce(ready("cindernewt-attack", seed), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "cindernewt";
    enemy.name = "Cindernewt";
    enemy.health = enemy.maxHealth = 100;
    enemy.combat = freshCombat();
    enemy.lastAbility = "cindernewt-attack";
    draft.battle!.enemies.slice(1).forEach((other) => {
      other.health = 0;
    });
    draft.team.forEach((unit) => {
      unit.block = 100;
      unit.combat!.armor = 5;
    });
    draft.reserves = [
      {
        id: "backup",
        species: "captoad",
        health: 30,
        block: 0,
        attacked: false,
        combat: { ...freshCombat(), armor: 5 },
      },
    ];
    draft.roster.push("captoad");
    draft.discovery.encountered.push("captoad");
    draft.discovery.recruited.captoad = 1;
  });
  const result = dispatch(game, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  const actions = result.events.flatMap((event, index) => (event.kind === "action" ? [index] : []));
  expect(result.events[actions[0]!]?.text).toContain(`uses ${name}`);
  const firstAction = result.events.slice(actions[0], actions[1]);
  expect(
    firstAction
      .filter(
        (event) => event.status === status && event.outcome === (status === "armor" ? "remove" : "apply"),
      )
      .map((event) => event.targetId),
  ).toEqual(game.team.map((unit) => unit.id));
  expect(result.state.reserves[0]!.combat!.armor).toBe(5);
  expect(result.state.reserves[0]!.combat!.blind).toBe(false);
});

it("stops melting remaining Armor when an Armor-break burst knocks out the actor", () => {
  const game = produce(ready("cindernewt-ember-breath"), (draft) => {
    draft.team[0]!.health = 1;
    draft.team[0]!.combat!.deathDoorUsed = true;
    draft.battle!.enemies.forEach((enemy, index) => {
      enemy.combat.armor = index === 0 ? 1 : 5;
      enemy.block = 10;
      if (index === 0) enemy.species = "emberback";
    });
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.state.team[0]!.health).toBe(0);
  expect(result.state.battle!.enemies.map((enemy) => enemy.combat.armor)).toEqual([0, 5, 5]);
});

it.each([
  [1, "burn"],
  [3, "physical"],
] as const)("enemy seed %i resolves Cinder Lash as %s", (seed, damageType) => {
  const game = produce(ready("cindernewt-attack", seed), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "cindernewt";
    enemy.name = "Cindernewt";
    enemy.combat = freshCombat();
    enemy.health = enemy.maxHealth = 100;
    enemy.lastAbility = "cindernewt-ember-breath";
    draft.battle!.enemies.slice(1).forEach((other) => {
      other.health = 0;
    });
    draft.team.forEach((unit) => {
      unit.combat!.controlled = "stun";
      unit.combat!.controlTurns = 1;
    });
  });
  const result = dispatch(game, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  expect(result.events.find((event) => event.kind === "action")?.text).toContain("uses Cinder Lash");
  expect(result.events.find((event) => event.kind === "damage")).toMatchObject({
    actorId: "enemy-0",
    damageType,
    amount: 6,
  });
});
