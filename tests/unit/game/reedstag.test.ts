import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, cardText, definition, species } from "../../../src/game/content";
import { freshCombat, grantBlock, grantStatus, restoreHealth } from "../../../src/game/combat";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { accept, teamRun, winBattle } from "../../support/game";

function ready(id = "reedstag-guard") {
  return produce(teamRun(1, ["reedstag", "mossguard", "reedstag"]), (game) => {
    const card = game.cards.find((card) => card.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    game.battle!.enemies.forEach((enemy) => {
      enemy.block = 0;
      enemy.combat = freshCombat();
    });
    game.rng = 1;
  });
}

it("plays the one-Mana kit with deterministic previews, rules and current-format resume", () => {
  expect(
    CARDS.filter((card) => card.species === "reedstag").map((card) => [card.cost, cardText(card)]),
  ).toEqual([
    [1, "Deal 6 Nature damage"],
    [1, "Gain 3 Block; Gain 3 Thorns"],
    [1, "Restore 4 Health to the most injured ally; Cleanse the healed ally"],
  ]);
  for (const id of ["reedstag-attack", "reedstag-guard", "reedstag-heal"]) {
    const game = ready(id);
    const cardId = game.battle!.hand[0]!;
    const targetId = id === "reedstag-attack" ? "enemy-0" : undefined;
    const result = dispatch(game, { type: "play", cardId, targetId, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(previewCard(game, cardId, targetId)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    if (id === "reedstag-attack") {
      expect(result.state.battle!.enemies[0]!.health).toBe(game.battle!.enemies[0]!.health - 6);
      expect(result.events).toContainEqual(
        expect.objectContaining({ kind: "damage", damageType: "nature", amount: 6 }),
      );
    }
    if (id === "reedstag-guard") {
      expect(result.state.team.map((unit) => unit.block)).toEqual([3, 0, 0]);
      expect(result.state.team.map((unit) => unit.combat!.thorns)).toEqual([3, 0, 0]);
    }
  }
  const game = ready();
  expect(dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, targetId: "ally-1" }).state).toBe(
    game,
  );
});

it.each([0, 1, 2])("heals and fully Cleanses the same most injured ally at position %i", (index) => {
  const game = produce(ready("reedstag-heal"), (draft) => {
    draft.team.forEach((unit) => {
      unit.health -= 5;
      unit.combat!.poison = 1;
    });
    const target = draft.team[index]!;
    target.health -= 2; // Healing makes another ally more injured: do not reselect for Cleanse
    Object.assign(target.combat!, { burn: 2, bleed: 3, stun: 1, freeze: 1, blind: true });
    if (index !== 0) Object.assign(target.combat!, { controlled: "stun", controlTurns: 1 });
    draft.reserves.push({ ...draft.team[1]!, id: "backup", health: 1 });
    draft.roster.push("mossguard");
  });
  const result = accept(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.team[index]!.health).toBe(game.team[index]!.health + 4);
  for (const key of ["burn", "poison", "bleed", "stun", "freeze"] as const)
    expect(result.team[index]!.combat![key]).toBe(0);
  expect(result.team[index]!.combat!.blind).toBe(false);
  expect(result.team[index]!.combat!.controlled).toBeNull();
  expect(result.team.filter((_, i) => i !== index).map((unit) => unit.combat!.poison)).toEqual([1, 1]);
  expect(result.reserves[0]!.health).toBe(1);
});

it("uses percentage injury, stable ties and full-Health Cleanse while excluding knockouts", () => {
  const game = produce(ready("reedstag-heal"), (draft) => {
    draft.team[0]!.health = 15;
    draft.team[1]!.health = 16;
    draft.team[2]!.health = 0;
    draft.team[0]!.combat!.poison = 2;
    draft.team[1]!.combat!.poison = 2;
  });
  const result = accept(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.team[0]!.health).toBe(19);
  expect(result.team[1]!.health).toBe(16);
  const full = produce(ready("reedstag-heal"), (draft) => {
    draft.team[0]!.combat!.poison = 2;
  });
  expect(
    accept(full, { type: "play", cardId: full.battle!.hand[0]!, autoEndTurn: false }).team[0]!.combat!.poison,
  ).toBe(0);
});

it.each([20, 40, 60, 80, 90, 100])(
  "shares both effects at the %i percent tier without recursive amplification",
  (chance) => {
    const copies = [20, 40, 60, 80, 90, 100].indexOf(chance) + 1;
    const apply = (fraction: number) =>
      produce(ready(), (game) => {
        game.discovery.recruited.reedstag = copies;
        // Find a seed whose first roll is immediately below/above this tier
        let seed = 0;
        while (true) {
          const value = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
          if (value >= fraction && value < fraction + 0.01) break;
          seed++;
        }
        game.rng = seed;
        grantBlock(game, game.team[0]!, 3, []);
      });
    const shared = apply((chance - 1) / 100);
    expect(shared.team.map((unit) => unit.block)).toEqual([3, 3, 3]);
    if (chance < 100) expect(apply(chance / 100).team.map((unit) => unit.block)).toEqual([3, 0, 0]);
    const both = produce(ready(), (game) => {
      game.discovery.recruited.reedstag = 6;
      const rng = game.rng;
      grantBlock(game, game.team[0]!, 3, []);
      grantStatus(game.team[0]!, "thorns", 3, [], game);
      expect(game.rng).toBe(rng);
    });
    expect(both.team.map((unit) => unit.block)).toEqual([3, 3, 3]);
    expect(both.team.map((unit) => unit.combat!.thorns)).toEqual([3, 3, 3]);
    expect(species("reedstag").passiveTiers[copies - 1]!.effects).toEqual([
      { kind: "shareProtection", amount: chance },
    ]);
  },
);

it("rolls once per effect for the whole team, independently for Block and Thorns", () => {
  const game = produce(ready(), (draft) => {
    draft.rng = 1973;
  });
  // First roll is below 20%, second above it
  const result = accept(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.team.map((unit) => unit.block)).toEqual([3, 3, 3]);
  expect(result.team.map((unit) => unit.combat!.thorns)).toEqual([3, 0, 0]);
});

it("shares actual capped gains and Boon grants, excluding backup and knockouts", () => {
  const result = produce(ready(), (game) => {
    game.discovery.recruited.reedstag = 6;
    game.boons = ["groves-favor"];
    game.team[0]!.block = 999999;
    game.team[0]!.health -= 4;
    game.team[2]!.health = 0;
    game.reserves.push({ ...game.team[0]!, id: "backup", block: 0, combat: freshCombat() });
    grantBlock(game, game.team[0]!, 3, []);
    restoreHealth(game.team[0]!, 4, [], false, game);
  });
  expect(result.team.map((unit) => unit.block)).toEqual([1000000, 1, 0]);
  expect(result.team.map((unit) => unit.combat!.thorns)).toEqual([1, 1, 0]);
  expect(result.reserves[0]!.combat!.thorns).toBe(0);
  expect(result.reserves[0]!.block).toBe(0);
});

it("does not share from backup, knockouts, zero gains or an isolated source", () => {
  produce(ready(), (game) => {
    game.discovery.recruited.reedstag = 6;
    game.reserves.push({ ...game.team[0]!, id: "backup", combat: freshCombat() });
    grantBlock(game, game.reserves[0]!, 3, []);
    expect(game.team.map((unit) => unit.block)).toEqual([0, 0, 0]);
    game.team[1]!.health = 0;
    game.team[2]!.health = 0;
    const rng = game.rng;
    grantBlock(game, game.team[0]!, 3, []);
    grantStatus(game.team[0]!, "thorns", 0, [], game);
    grantBlock(game, game.team[1]!, 3, []);
    expect(game.rng).toBe(rng);
    expect(game.team[1]!.block).toBe(0);
  });
});

it("uses enemy base sharing regardless of collection and never shares across sides", () => {
  const shared = produce(ready(), (game) => {
    game.discovery.recruited.reedstag = 6;
    const enemy = game.battle!.enemies[0]!;
    enemy.species = "reedstag";
    game.rng = 1972;
    grantBlock(game, enemy, 2, []);
    game.rng = 1972;
    grantStatus(enemy, "thorns", 3, [], game);
  });
  expect(shared.battle!.enemies.map((unit) => unit.block)).toEqual([2, 2, 2]);
  expect(shared.battle!.enemies.map((unit) => unit.combat.thorns)).toEqual([3, 3, 3]);
  expect(shared.team.map((unit) => unit.block)).toEqual([0, 0, 0]);
  produce(shared, (game) => {
    game.rng = 1;
    grantBlock(game, game.battle!.enemies[0]!, 2, []);
    expect(game.battle!.enemies.map((unit) => unit.block)).toEqual([4, 2, 2]);
  });
});

it("enemy Mending Spring Cleanses its healed ally rather than its attack target", () => {
  const setup = produce(ready(), (game) => {
    const enemy = game.battle!.enemies[0]!;
    enemy.species = "reedstag";
    enemy.lastAbility = "reedstag-attack";
    enemy.combat.blind = true;
    game.battle!.enemies[1]!.health = 2;
    game.battle!.enemies[1]!.combat.blind = true;
    game.battle!.enemies[1]!.combat.controlled = "freeze";
    game.battle!.enemies[1]!.combat.controlTurns = 1;
    game.battle!.enemies[2]!.health = 0;
    game.rng = 1;
  });
  const result = dispatch(
    produce(setup, (game) => {
      game.rng = 1000;
    }),
    { type: "endTurn" },
  );
  expect(result.accepted).toBe(true);
  expect(result.events.some((event) => event.text.includes("uses Mending Spring"))).toBe(true);
  expect(result.state.battle!.enemies[1]!.combat.blind).toBe(false);
  expect(result.state.battle!.enemies[1]!.combat.controlled).toBeNull();
  expect(result.state.battle!.enemies[0]!.combat.blind).toBe(true);
});

it("discovers, recruits and resumes Reedstag with all three cards", () => {
  const initial = createGame(7);
  let game = accept(
    accept(initial, { type: "draft", species: initial.starterOffers.find((kind) => kind !== "reedstag")! }),
    { type: "start" },
  );
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = COMBAT_PACKS.findIndex((pack) => pack[0] === "reedstag");
    }),
    { type: "beginBattle" },
  );
  expect(game.discovery.encountered).toContain("reedstag");
  game = accept(winBattle(game), { type: "recruit", species: "reedstag" });
  expect(game.discovery.recruited.reedstag).toBe(1);
  expect(
    game.cards
      .filter((card) => card.ownerId === game.team[1]!.id)
      .map((card) => definition(card.definitionId).species),
  ).toEqual(["reedstag", "reedstag", "reedstag"]);
  expect(decodeSave(encodeSave(game))).toEqual(game);
  expect(() => decodeSave(JSON.stringify({ ...game, version: 27 }))).toThrow();
});

it("does not chain Reedguard through Thorns granted by shared Block", () => {
  const result = produce(ready(), (game) => {
    game.discovery.recruited.reedstag = 6;
    game.boons = ["ironwood-buckler"];
    grantBlock(game, game.team[0]!, 3, []);
  });
  expect(result.team.map((unit) => unit.block)).toEqual([3, 3, 3]);
  expect(result.team.map((unit) => unit.combat!.thorns)).toEqual([1, 2, 2]);
});
