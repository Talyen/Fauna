import { setBattleCards } from "../../support/cards";
import {
  authoredPack,
  swapFixture,
  addBackups,
  prepareDestination,
  accept,
  teamRun,
  winBattle,
} from "../../support/game";
import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, definition, species, type DamageType } from "../../../src/game/content";
import { cardText } from "../../../src/game/card-rules";
import { freshCombat, hit, removeEffects, tickStatuses } from "../../../src/game/combat/index";
import { createGame, dispatch, previewCard } from "../../../src/game/engine";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { combatStatuses } from "../../../src/ui/shared/combat/combat-status-model";
import type { GameEvent } from "../../../src/game/types";

function ready(id = "prismram-guard") {
  return produce(teamRun(1, ["prismram", "mossguard", "reedstag"]), (game) => {
    const card = game.cards.find((card) => card.definitionId === id)!;
    setBattleCards(game, [card.id]);
    game.battle!.enemies.forEach((enemy) => {
      enemy.block = 0;
      enemy.combat = freshCombat();
      enemy.health = enemy.maxHealth;
    });
  });
}

it("wards only Prismram for one Mana, previews faithfully, and persists visible protection across resume", () => {
  const game = ready();
  const cardId = game.battle!.hand[0]!;
  const rejected = dispatch(game, { type: "play", cardId, targetId: "ally-1" });
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(game);
  const result = dispatch(game, { type: "play", cardId, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.team.map((unit) => unit.block)).toEqual([3, 0, 0]);
  expect(result.state.team[0]!.combat!.reflect).toBe(true);
  expect(result.state.battle!.mana).toBe(game.battle!.mana - 1);
  expect(previewCard(game, cardId).state).toEqual(result.state);
  expect(previewCard(game, cardId).events).toEqual(result.events);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  expect(combatStatuses(result.state.team[0]!.combat)).toContainEqual(
    expect.objectContaining({ id: "reflect", count: 1, text: expect.stringContaining("harmful status") }),
  );
  expect(cardText(definition("prismram-guard"))).toBe("Gain 3 Block; Reflect the next harmful status effect");
});

it.each(["burn", "poison", "bleed", "stun", "freeze"] as const)(
  "reflects %s buildup at full strength without repeating direct damage or bouncing again",
  (type) => {
    const events: GameEvent[] = [];
    const result = produce(ready(), (game) => {
      const ram = game.team[0]!;
      ram.combat!.reflect = true;
      game.battle!.enemies.forEach((enemy) => {
        enemy.combat.reflect = true;
      });
      hit(game, game.battle!.enemies[0]!, ram, 4, type, events, { origin: "proc" as const });
    });
    expect(result.team[0]!.health).toBe(26);
    expect(result.team[0]!.combat![type]).toBe(0);
    expect(result.team[0]!.combat!.reflect).toBe(false);
    const recipients = result.battle!.enemies.filter((enemy) => enemy.combat[type] > 0);
    expect(recipients).toHaveLength(1);
    expect(recipients[0]!.combat[type]).toBe(4);
    expect(recipients[0]!.combat.reflect).toBe(true);
    expect(result.battle!.enemies.map((enemy) => enemy.health)).toEqual(
      ready().battle!.enemies.map((enemy) => enemy.health),
    );
    expect(
      events.filter((event): event is Extract<GameEvent, { kind: "damage" }> => event.kind === "damage"),
    ).toHaveLength(1);
    expect(events.filter((event) => event.kind === "status" && event.status === "reflect")).toHaveLength(1);
    if (["burn", "poison", "bleed"].includes(type)) {
      expect(recipients[0]!.combat.statusSources[type as "burn" | "poison" | "bleed"]).toBe("ally-0");
      expect(recipients[0]!.combat.bleedLeech).toEqual([]);
    }
    expect(decodeSave(encodeSave(result))).toEqual(result);
  },
);

it.each([
  [1, 2204],
  [2, 2462],
  [3, 140],
  [4, 398],
  [5, 656],
  [6, 914],
])("uses the %i-copy Refraction chance and higher tiers replace the previous chance", (copies, seed) => {
  const setup = produce(ready(), (game) => {
    game.discovery.recruited.prismram = copies;
  });
  const received = (count: number) =>
    produce(setup, (game) => {
      game.discovery.recruited.prismram = count;
      game.rng = seed;
      hit(game, game.battle!.enemies[0]!, game.team[0]!, 2, "poison", [], { origin: "proc" as const });
    });
  expect(received(copies).team[0]!.combat!.poison).toBe(0);
  if (copies > 1) expect(received(copies - 1).team[0]!.combat!.poison).toBe(2);
  const missed = produce(setup, (game) => {
    game.rng = 1800; // First roll exceeds 90%
    hit(game, game.battle!.enemies[0]!, game.team[0]!, 2, "poison", [], { origin: "proc" as const });
  });
  expect(missed.team[0]!.combat!.poison).toBe(2);
  expect(species("prismram").passiveTiers[copies - 1]!.effects).toEqual([
    { kind: "statusReflection", amount: copies * 10 },
  ]);
});

it("spends a Ward on blocked buildup but preserves a refreshed Ward through control immunity and periodic damage", () => {
  const result = produce(ready(), (game) => {
    const ram = game.team[0]!;
    ram.combat!.reflect = true;
    ram.block = 5;
    hit(game, game.battle!.enemies[0]!, ram, 4, "burn", [], { origin: "proc" as const });
    expect(ram.combat!.reflect).toBe(false);
    ram.combat!.reflect = true;
    ram.block = 0;
    ram.combat!.cooldown = 3;
    hit(game, game.battle!.enemies[0]!, ram, 1, "stun", [], { origin: "proc" as const });
    expect(ram.combat!.reflect).toBe(true);
    ram.combat!.poison = 2;
    tickStatuses(game, ram, []);
    expect(ram.combat!.reflect).toBe(true);
    hit(game, game.battle!.enemies[0]!, ram, 1, "bleed", [], { origin: "proc" as const });
    expect(ram.combat!.reflect).toBe(false);
    game.rng = 1; // Base passive misses
    hit(game, game.battle!.enemies[0]!, ram, 1, "burn", [], { origin: "proc" as const });
  });
  expect(result.team[0]!.combat!.burn).toBe(1);
});

it("chooses living deployed opponents for either side and never scales enemy Refraction with collection rank", () => {
  const result = produce(ready(), (game) => {
    game.discovery.recruited.prismram = 6;
    game.rng = 140; // 29% succeeds for upgraded allies, misses the enemy base tier
    const enemy = game.battle!.enemies[0]!;
    enemy.species = "prismram";
    hit(game, game.team[1]!, enemy, 1, "poison", [], { origin: "proc" as const });
    expect(enemy.combat.poison).toBe(1);
    enemy.combat.reflect = true;
    game.team[0]!.health = 0;
    game.team[2]!.health = 0;
    addBackups(game, { ...game.team[0]!, id: "reserve", health: 30, combat: freshCombat() });
    hit(game, game.team[1]!, enemy, 2, "burn", [], { origin: "proc" as const });
  });
  expect(result.team[1]!.combat!.burn).toBe(2);
  expect(result.reserves[0]!.combat!.burn).toBe(0);
  expect(result.battle!.enemies[0]!.combat.burn).toBe(0);
});

it("applies reflected control normally and allows Purge to remove a pending Ward", () => {
  const result = produce(ready(), (game) => {
    const ram = game.team[0]!;
    ram.combat!.reflect = true;
    game.battle!.enemies.slice(1).forEach((enemy) => {
      enemy.health = 0;
    });
    const enemy = game.battle!.enemies[0]!;
    enemy.health = enemy.maxHealth;
    hit(game, enemy, ram, enemy.maxHealth / 2, "freeze", [], { origin: "proc" as const });
    expect(game.battle!.enemies[0]!.combat.controlled).toBe("freeze");
    expect(ram.combat!.controlled).toBeNull();
    ram.combat!.reflect = true;
    removeEffects(ram, "purge", 1, [], game);
  });
  expect(result.team[0]!.combat!.reflect).toBe(false);
});

it.each([
  ["prismram-attack", 6, "physical"],
  ["prismram-spectrum-lance", 4, "light"],
] as const)("resolves %s and purges after Spectrum Lance damage", (id, amount, type: DamageType) => {
  const game = produce(ready(id), (draft) => {
    draft.rng = 1;
    draft.battle!.enemies[0]!.combat.controlled = "freeze";
    draft.battle!.enemies[0]!.combat.controlTurns = 1;
    draft.battle!.enemies[0]!.combat.reflect = true;
  });
  const cardId = game.battle!.hand[0]!;
  const result = dispatch(game, { type: "play", cardId, targetId: "enemy-0", autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.enemies[0]!.health).toBe(game.battle!.enemies[0]!.health - amount);
  expect(result.events).toContainEqual(expect.objectContaining({ kind: "damage", damageType: type, amount }));
  expect(result.state.battle!.enemies[0]!.combat.reflect).toBe(id !== "prismram-spectrum-lance");
  expect(result.state.battle!.mana).toBe(game.battle!.mana - 1);
  expect(previewCard(game, cardId, "enemy-0").state).toEqual(result.state);
});

it("discovers and recruits Prismram with its complete kit and rejects obsolete saves", () => {
  const initial = createGame(7);
  let game = accept(
    accept(initial, { type: "draft", species: initial.starterOffers.find((kind) => kind !== "prismram")! }),
    {
      type: "start",
    },
  );
  game = accept(
    produce(game, (draft) => {
      draft.expedition!.pack = authoredPack(
        draft.encounter,
        COMBAT_PACKS.findIndex((pack) => pack[0] === "prismram"),
      );
    }),
    { type: "beginBattle" },
  );
  expect(game.discovery.encountered).toContain("prismram");
  game = accept(winBattle(game), { type: "recruit", species: "prismram" });
  expect(game.discovery.recruited.prismram).toBe(1);
  expect(CARDS.filter((card) => card.species === "prismram").map((card) => card.cost)).toEqual([1, 1, 1]);
  expect(game.cards.filter((card) => card.ownerId === game.team[1]!.id)).toHaveLength(3);
  expect(decodeSave(encodeSave(game))).toEqual(game);
  expect(() => decodeSave(JSON.stringify({ ...game, version: 24 }))).toThrow();
});

it("refreshes one Ward, preserves it through swaps and turn changes, and resets it at the next battle", () => {
  let game = accept(ready(), { type: "play", cardId: ready().battle!.hand[0]!, autoEndTurn: false });
  game = produce(game, (draft) => {
    draft.battle!.hand = draft.battle!.discard.splice(0);
    addBackups(draft, {
      ...draft.team[1]!,
      id: "reserve",
      species: "captoad",
      health: 24,
      combat: freshCombat(),
    });
  });
  game = accept(game, { type: "play", cardId: game.battle!.hand[0]!, autoEndTurn: false });
  expect(game.team[0]!.combat!.reflect).toBe(true);
  // Use a separate live battle for the tactical swaps and transition.
  game = produce(ready(), (draft) => {
    draft.team[0]!.combat!.reflect = true;
    addBackups(draft, {
      ...draft.team[1]!,
      id: "reserve",
      species: "captoad",
      health: 24,
      combat: freshCombat(),
    });
    draft.battle!.enemies.forEach((enemy) => {
      enemy.combat.controlled = "freeze";
      enemy.combat.controlTurns = 2;
    });
  });
  game = swapFixture(game, { type: "swap", activeId: "ally-0", reserve: "reserve" });
  expect(game.reserves.find((unit) => unit.id === "ally-0")!.combat!.reflect).toBe(true);
  game = accept(game, { type: "endTurn" });
  expect(game.reserves.find((unit) => unit.id === "ally-0")!.combat!.reflect).toBe(true);
  expect(decodeSave(encodeSave(game))).toEqual(game);
  game = swapFixture(game, { type: "swap", activeId: "reserve", reserve: "ally-0" });
  game = produce(game, (draft) => {
    prepareDestination(draft);
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.team[0]!.combat!.reflect).toBe(false);
});
