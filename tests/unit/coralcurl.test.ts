import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, cardText, species } from "../../src/game/content";
import { freshCombat, hit, removeEffects, tickStatuses } from "../../src/game/combat";
import { dispatch, previewCard } from "../../src/game/engine";
import { canBuyTalent, TALENTS } from "../../src/game/progression";
import { decodeSave, encodeSave } from "../../src/game/save";
import { teamRun } from "./helpers";

function ready(id = "coralcurl-attack") {
  return produce(teamRun(1, ["coralcurl", "mossguard", "prismram"]), (game) => {
    const card = game.cards.find((entry) => entry.definitionId === id)!;
    game.battle!.hand = [card.id];
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    game.battle!.enemies.forEach((enemy) => {
      enemy.health = enemy.maxHealth;
      enemy.block = 0;
      enemy.combat = freshCombat();
    });
    game.rng = 1;
  });
}

it("plays the authored one-Mana kit with preview parity, Water XP and current saves", () => {
  expect(
    CARDS.filter((card) => card.species === "coralcurl").map((card) => [card.cost, cardText(card)]),
  ).toEqual([
    [1, "Gain 6 Block"],
    [1, "Deal 6 Water damage"],
    [1, "Swap out for a random backup; Blind all enemies"],
  ]);
  for (const id of ["coralcurl-guard", "coralcurl-attack", "coralcurl-swap"]) {
    const game = ready(id);
    const cardId = game.battle!.hand[0]!;
    const targetId = id.endsWith("attack") ? "enemy-0" : undefined;
    const result = dispatch(game, { type: "play", cardId, targetId, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(result.state.battle!.mana).toBe(3);
    expect(previewCard(game, cardId, targetId)).toEqual(result);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
    if (id.endsWith("guard")) expect(result.state.team[0]!.block).toBe(6);
    if (id.endsWith("attack")) {
      expect(result.state.battle!.enemies[0]!.health).toBe(12);
      expect(result.state.battleXP.water).toBe(1);
    }
    if (id.endsWith("swap"))
      expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
  }
  for (const version of [28, 29]) expect(() => decodeSave(JSON.stringify({ ...ready(), version }))).toThrow();
});

it.each([1, 2, 3, 4, 5, 6])("bursts for tier %i against the attacker even on exact absorption", (amount) => {
  produce(ready(), (game) => {
    game.discovery.recruited.coralcurl = amount;
    const target = game.team[0]!,
      attacker = game.battle!.enemies[0]!;
    target.block = 6;
    target.combat!.controlled = "stun";
    hit(game, attacker, target, 6, "water", []);
    expect(target.block).toBe(0);
    expect(target.health).toBe(species("coralcurl").health);
    expect(attacker.health).toBe(18 - amount);
    expect(game.battle!.enemies[1]!.health).toBe(16);
    expect(game.battleXP.water).toBeUndefined();
  });
});

it("does not burst on partial absorption, Dodge, Purge or retaliation", () => {
  for (const mode of ["partial", "dodge", "purge", "retaliation"] as const) {
    produce(ready(), (game) => {
      const target = game.team[0]!,
        attacker = game.battle!.enemies[0]!;
      target.block = 6;
      if (mode === "purge") removeEffects(target, "purge", 1, [], game);
      else
        hit(game, attacker, target, mode === "partial" ? 2 : 6, "water", [], {
          blindMiss: mode === "dodge",
          retaliation: mode === "retaliation",
        });
      expect(attacker.health).toBe(18);
    });
  }
});

it("uses enemy base Bubbleburst and prevents a bubble retaliation loop", () => {
  produce(ready(), (game) => {
    game.discovery.recruited.coralcurl = 6;
    const actor = game.team[0]!,
      enemy = game.battle!.enemies[0]!;
    enemy.species = "coralcurl";
    enemy.block = 6;
    enemy.combat.controlled = "stun";
    actor.block = 1;
    hit(game, actor, enemy, 6, "water", []);
    expect(enemy.health).toBe(18);
    expect(actor.block).toBe(0);
    expect(actor.health).toBe(28);
  });
});

it("captures Block break before Second Wind or another defense restores protection", () => {
  produce(ready(), (game) => {
    game.talents = ["armor.reactive-guard", "block.second-wind"];
    const target = game.team[0]!,
      attacker = game.battle!.enemies[0]!;
    target.block = 2;
    target.combat!.armor = 1;
    target.combat!.controlled = "stun";
    hit(game, attacker, target, 4, "physical", []);
    expect(target.block).toBe(3);
    expect(attacker.health).toBe(17);
  });
});

it("swaps the incoming kit into draw and Blinds enemies after leaving the battlefield", () => {
  const game = produce(ready("coralcurl-swap"), (draft) => {
    draft.roster.push("reedstag");
    draft.discovery.recruited.reedstag = 1;
    draft.discovery.encountered.push("reedstag");
    draft.reserves.push({
      id: "backup",
      species: "reedstag",
      health: 30,
      block: 2,
      combat: freshCombat(),
      attacked: false,
    });
  });
  const cardId = game.battle!.hand[0]!;
  const result = dispatch(game, { type: "play", cardId, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.id).toBe("backup");
  expect(result.state.reserves[0]!.species).toBe("coralcurl");
  expect(result.state.cards.filter((card) => card.ownerId === "backup")).toHaveLength(3);
  expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
  expect(result.events.findIndex((event) => event.actionType === "swap")).toBeLessThan(
    result.events.findIndex((event) => event.status === "blind"),
  );
  expect(previewCard(game, cardId)).toEqual(result);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

it("still Blinds enemies when alone without a living backup", () => {
  const game = produce(ready("coralcurl-swap"), (draft) => {
    draft.team[1]!.health = 0;
    draft.team[2]!.health = 0;
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.team[0]!.species).toBe("coralcurl");
  expect(result.state.battle!.enemies.every((enemy) => enemy.combat.blind)).toBe(true);
});

it("Water bypasses Armor reduction, obeys Block and leaves no damage status", () => {
  produce(ready(), (game) => {
    const enemy = game.battle!.enemies[0]!;
    enemy.block = 2;
    enemy.combat.armor = 20;
    enemy.combat.controlled = "stun";
    hit(game, game.team[0]!, enemy, 6, "water", []);
    expect(enemy.health).toBe(14);
    expect(enemy.block).toBe(0);
    expect(enemy.combat.armor).toBe(19);
    expect([enemy.combat.burn, enemy.combat.poison, enemy.combat.bleed, enemy.combat.freeze]).toEqual([
      0, 0, 0, 0,
    ]);
    const before = enemy.health;
    tickStatuses(game, enemy, []);
    expect(enemy.health).toBe(before);
  });
});

it("gates all three Water talent rows and applies Pressure, High Tide, Seafoam and Erosion", () => {
  produce(ready(), (game) => {
    game.keywordXP.water = 10000;
    const water = TALENTS.filter((talent) => talent.keyword === "water");
    for (const talent of water) {
      game.talents = water.filter((entry) => entry.row < talent.row).map((entry) => entry.id);
      expect(canBuyTalent(game, talent.id)).toBe(true);
      if (talent.row > 0) {
        game.talents.pop();
        expect(canBuyTalent(game, talent.id)).toBe(false);
      }
    }
    game.talents = ["water.pressure", "water.high-tide", "water.seafoam", "water.erosion"];
    const actor = game.team[0]!,
      enemy = game.battle!.enemies[0]!;
    actor.block = 3;
    enemy.combat.controlled = "stun";
    enemy.combat.armor = 10;
    hit(game, actor, enemy, 6, "water", []);
    expect(enemy.health).toBe(9);
    expect(actor.block).toBe(5);
    expect(enemy.combat.armor).toBe(7);
  });
});

it("Water hit rewards include full absorption and exclude missed and passive damage", () => {
  for (const mode of ["blocked", "miss", "retaliation"] as const)
    produce(ready(), (game) => {
      game.talents = ["water.seafoam", "water.erosion"];
      const actor = game.team[0]!,
        enemy = game.battle!.enemies[0]!;
      enemy.block = 20;
      enemy.combat.armor = 10;
      enemy.combat.controlled = "stun";
      hit(game, actor, enemy, 6, "water", [], {
        blindMiss: mode === "miss",
        retaliation: mode === "retaliation",
      });
      expect(actor.block).toBe(mode === "blocked" ? 2 : 0);
      expect(enemy.combat.armor).toBe(mode === "blocked" ? 8 : 10);
    });
});

it("Cleansing Current and Riptide use seeded rolls and resume deterministically", () => {
  // Controlled target skips Dodge; choose a noncritical roll followed by two successful procs
  let seed = 1;
  for (; ; seed++) {
    let rng = seed;
    const rolls = Array.from(
      { length: 3 },
      () => (rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296,
    );
    if (rolls[0]! >= 0.05 && rolls[1]! < 0.2 && rolls[2]! < 0.2) break;
  }
  const game = produce(ready(), (draft) => {
    draft.talents = TALENTS.filter((talent) => talent.keyword === "water").map((talent) => talent.id);
    draft.keywordXP.water = 10000;
    draft.team[0]!.combat!.poison = 2;
    draft.battle!.enemies[0]!.combat.controlled = "stun";
    draft.battle!.enemies[0]!.combat.controlTurns = 1;
    draft.rng = seed;
    draft.battle!.hand = [];
    draft.battle!.draw = draft.cards.map((card) => card.id);
  });
  const apply = (state: typeof game) =>
    produce(state, (draft) => {
      hit(draft, draft.team[0]!, draft.battle!.enemies[0]!, 6, "water", []);
    });
  const result = apply(game);
  expect(result.team[0]!.combat!.poison).toBe(0);
  expect(result.battle!.hand).toContain(
    game.cards.find((card) => card.definitionId === "coralcurl-attack")!.id,
  );
  expect(apply(decodeSave(encodeSave(game)))).toEqual(result);
});

it("rejects unaffordable Water cards without changing state or RNG", () => {
  const game = produce(ready(), (draft) => {
    draft.battle!.mana = 0;
  });
  const result = dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, targetId: "enemy-0" });
  expect(result.accepted).toBe(false);
  expect(result.state).toBe(game);
  expect(result.events).toEqual([]);
});

it("enemy Coral Spiral Blinds every living deployed ally after reordering", () => {
  const game = produce(ready(), (draft) => {
    draft.battle!.enemies[0]!.species = "coralcurl";
    draft.battle!.enemies[0]!.lastAbility = "coralcurl-guard";
    draft.battle!.enemies.slice(1).forEach((enemy) => {
      enemy.combat.controlled = "stun";
      enemy.combat.controlTurns = 1;
    });
    draft.rng = 1000;
  });
  const result = dispatch(game, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  expect(result.events.some((event) => event.text.includes("uses Coral Spiral"))).toBe(true);
  expect(result.state.team.every((unit) => unit.health === 0 || unit.combat!.blind)).toBe(true);
});
