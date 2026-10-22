import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, cardText, definition, species } from "../../../src/game/content";
import { applyBlind, freshCombat, hit } from "../../../src/game/combat";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { battleChoices } from "../../../src/application/battle-policy";
import type { GameEvent } from "../../../src/game/types";
import { accept, teamRun, winBattle } from "../../support/game";

function ready(id = "glintstride-attack", copies = 1) {
  return produce(teamRun(1, ["glintstride", "mossguard", "prismram"]), (game) => {
    game.discovery.recruited.glintstride = copies;
    const card = game.cards.find((entry) => entry.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    for (const enemy of game.battle!.enemies) {
      enemy.block = 0;
      enemy.combat = freshCombat();
    }
    game.rng = 1;
  });
}
const play = (game: ReturnType<typeof ready>, targetId?: string) =>
  dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, targetId, autoEndTurn: false });

it("plays the selected one-Mana kit with detached preview parity and current-format resume", () => {
  const kit = CARDS.filter((card) => card.species === "glintstride");
  expect(kit.map((card) => [card.cost, cardText(card)])).toEqual([
    [1, "Deal 6 Light damage"],
    [1, "Gain 30% Dodge until your next turn; Draw 1 card"],
    [1, "Blind all enemies"],
  ]);
  for (const card of kit) {
    const game = ready(card.id);
    const targetId = card.effect === "attack" ? "enemy-0" : undefined;
    const original = encodeSave(game);
    const result = play(game, targetId);
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(previewCard(game, game.battle!.hand[0]!, targetId)).toEqual(result);
    expect(encodeSave(game)).toBe(original);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    if (card.effect === "attack") {
      expect(result.events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([
        6,
      ]);
    } else if (card.effect === "dodge") {
      expect(result.state.team[0]!.combat!.temporaryDodge).toBe(30);
      expect(result.state.battle!.hand).toHaveLength(1);
    } else {
      expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
      expect(result.events.some((event) => event.kind === "damage")).toBe(false);
      expect(result.state.battleXP.light).toBeUndefined();
    }
  }
  expect(() => decodeSave(JSON.stringify({ ...ready(), version: 36 }))).toThrow();
});

it.each([1, 2, 3, 4, 5, 6])(
  "adds %i Light damage only to Glintstride's attacks on Blinded enemies",
  (copies) => {
    for (const blinded of [false, true]) {
      const game = produce(ready("glintstride-attack", copies), (draft) => {
        draft.battle!.enemies[0]!.combat.blind = blinded;
      });
      const result = play(game, "enemy-0");
      expect(result.accepted).toBe(true);
      expect(
        result.events
          .filter((event) => event.kind === "damage")
          .map((event) => [event.damageType, event.amount]),
      ).toEqual(
        blinded
          ? [
              ["light", 6],
              ["light", copies],
            ]
          : [["light", 6]],
      );
      expect(result.state.battle!.enemies[0]!.combat.blind).toBe(blinded);
      expect(species("glintstride").passiveTiers[copies - 1]!.description).toBe(
        `Glintstride’s attacks deal ${copies} additional Light damage to Blinded enemies`,
      );
      expect(previewCard(game, game.battle!.hand[0]!, "enemy-0")).toEqual(result);
    }
  },
);

it("does not grant Wrong Foot to teammates or trigger it from misses and non-attack packets", () => {
  produce(ready("glintstride-attack", 6), (game) => {
    const source = game.team[0]!,
      target = game.battle!.enemies[0]!;
    target.health = target.maxHealth = 100;
    target.combat.blind = true;
    for (const options of [
      { blindMiss: true },
      { periodic: true },
      { retaliation: true },
      { derived: true },
      { proc: true },
    ]) {
      const events: GameEvent[] = [];
      hit(game, source, target, 2, "light", events, options);
      expect(events.filter((event) => event.kind === "damage")).toHaveLength("blindMiss" in options ? 0 : 1);
    }
    const events: GameEvent[] = [];
    game.rng = 1;
    hit(game, game.team[1]!, target, 2, "light", events);
    expect(events.filter((event) => event.kind === "damage")).toHaveLength(1);
  });
});

it("routes the supplemental Light through remaining Block and Light resistance", () => {
  produce(ready("glintstride-attack", 6), (game) => {
    const source = game.battle!.enemies[0]!,
      target = game.team[0]!;
    source.species = "glintstride";
    target.block = 2;
    target.combat!.blind = true;
    game.talents = ["light.celestial-ward"];
    const events: GameEvent[] = [];
    const health = target.health;
    hit(game, source, target, 2, "physical", events);
    // Enemy uses the base +1 tier, rounded after the allied Light resistance
    expect(target.block).toBe(0);
    expect(target.health).toBe(health - 1);
    expect(
      events.filter((event) => event.kind === "damage").map((event) => [event.damageType, event.amount]),
    ).toEqual([
      ["physical", 0],
      ["light", 1],
    ]);
  });
});

it("respects Nullify, Reflect and knockouts when blinding all enemies, and scores it for Auto-play", () => {
  const game = produce(ready("glintstride-teamBlind"), (draft) => {
    draft.battle!.enemies[0]!.combat.nullify = true;
    draft.battle!.enemies[1]!.combat.reflect = true;
    draft.battle!.enemies[2]!.health = 0;
  });
  expect(battleChoices(game, false)).toContainEqual({
    type: "play",
    cardId: game.battle!.hand[0]!,
    autoEndTurn: false,
  });
  const result = play(game);
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.enemies.map((enemy) => enemy.combat.blind)).toEqual([false, false, false]);
  expect(result.state.battle!.enemies[0]!.combat.nullify).toBe(false);
  expect(result.state.battle!.enemies[1]!.combat.reflect).toBe(false);
  expect(result.state.team.some((ally) => ally.combat!.blind)).toBe(true);
  expect(result.events.some((event) => event.kind === "damage")).toBe(false);
});

it("encounters, recruits and resumes Glintstride with its complete kit", () => {
  let game = produce(ready(), (draft) => {
    draft.encounter = 0;
    draft.expedition = { pack: COMBAT_PACKS.findIndex((pack) => pack[0] === "glintstride") };
    draft.phase = "teamSelection";
    delete draft.discovery.recruited.glintstride;
    draft.discovery.encountered = draft.discovery.encountered.filter((id) => id !== "glintstride");
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.discovery.encountered).toContain("glintstride");
  game = accept(winBattle(game), { type: "recruit", species: "glintstride" });
  expect(game.discovery.recruited.glintstride).toBe(1);
  expect(decodeSave(encodeSave(game))).toEqual(game);
  expect(
    CARDS.filter((card) => card.species === "glintstride").map((card) => definition(card.id).cost),
  ).toEqual([1, 1, 1]);
});

it("uses False Horizon and Mirage Run on the enemy side without player draw or damage", () => {
  for (const seed of [1, 1000]) {
    const game = produce(ready(), (draft) => {
      const enemy = draft.battle!.enemies[0]!;
      enemy.species = "glintstride";
      enemy.lastAbility = "glintstride-attack";
      for (const other of draft.battle!.enemies.slice(1)) other.health = 0;
      draft.rng = seed;
    });
    const result = dispatch(game, { type: "endTurn" });
    expect(result.accepted).toBe(true);
    const enemy = result.state.battle!.enemies[0]!;
    expect(enemy.lastAbility).toBe(seed === 1 ? "glintstride-dodge" : "glintstride-teamBlind");
    expect(result.events.some((event) => event.kind === "damage" && event.actorId === enemy.id)).toBe(false);
    if (seed === 1000) expect(result.state.team.every((ally) => ally.combat!.blind)).toBe(true);
    else expect(enemy.combat.temporaryDodge).toBe(30);
  }
});

it("spends remaining Block on the bonus and suppresses it when the original attack is lethal", () => {
  for (const health of [6, 18]) {
    produce(ready("glintstride-attack", 6), (game) => {
      const source = game.team[0]!,
        target = game.battle!.enemies[0]!;
      target.health = health;
      target.combat.blind = true;
      target.block = health === 18 ? 8 : 0;
      const events: GameEvent[] = [];
      hit(game, source, target, 6, "light", events);
      expect(target.health).toBe(health === 18 ? 14 : 0);
      expect(target.block).toBe(0);
      expect(events.filter((event) => event.kind === "damage")).toHaveLength(health === 18 ? 2 : 1);
    });
  }
});

it("does not offer a redundant False Horizon once every enemy is Blinded", () => {
  const game = produce(ready("glintstride-teamBlind"), (draft) => {
    for (const enemy of draft.battle!.enemies) enemy.combat.blind = true;
  });
  expect(battleChoices(game)).toEqual([]);
});

it("Blind expires on the target's next attack and no longer enables Wrong Foot", () => {
  produce(ready("glintstride-attack", 6), (game) => {
    const source = game.team[0]!,
      target = game.battle!.enemies[0]!;
    applyBlind(game, source, target, []);
    hit(game, target, source, 1, "physical", []);
    expect(target.combat.blind).toBe(false);
    const events: GameEvent[] = [];
    game.rng = 1;
    hit(game, source, target, 2, "light", events);
    expect(events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([2]);
  });
});
