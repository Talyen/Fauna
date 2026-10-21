import { afterEach, expect, it, vi } from "vitest";
import { produce } from "immer";
import * as content from "../../src/game/content";
import { creaturePassive } from "../../src/game/progression";
import { actionValue, enemyAbilityValue, retainedBlock } from "../../src/game/rules";
import { contentCatalog, validateCatalog } from "../../src/game/content-validation";
import { createGame } from "../../src/game/engine";
import { hit } from "../../src/game/combat";
import type { GameEvent } from "../../src/game/types";
import { accept, teamRun } from "./helpers";

afterEach(() => vi.restoreAllMocks());

it("resolves the complete passive at the exact collected star rank", () => {
  for (const kind of content.SPECIES) {
    for (let copies = 0; copies <= 6; copies++) {
      const game = produce(createGame(), (draft) => {
        if (copies) draft.discovery.recruited[kind.id] = copies;
      });
      const rank = Math.max(0, copies - 1);
      expect(creaturePassive(game, kind.id)).toEqual({ rank, ...kind.passiveTiers[rank]! });
    }
  }
});

it("uses the exact tier for card rules and battle start without scaling enemies", () => {
  const base = content.species;
  vi.spyOn(content, "species").mockImplementation((kind) => {
    const original = base(kind);
    if (kind !== "prismram") return original;
    const tier = (rank: number): content.PassiveTier => ({
      description: `Guard cards grant ${rank + 5} extra Block; Start battle with ${rank + 1} Block and ${rank + 2} Thorns`,
      effects: [
        { kind: "cardBonus", trigger: "guard", amount: rank + 5 },
        { kind: "battleStart", effect: "block", amount: rank + 1 },
        { kind: "battleStart", effect: "thorns", amount: rank + 2 },
      ],
    });
    return {
      ...original,
      passiveTiers: [original.passiveTiers[0], original.passiveTiers[1], tier(2), tier(3), tier(4), tier(5)],
    };
  });
  const guard = { id: "test", definitionId: "prismram-guard", ownerId: "ally-0", level: 0 };
  for (const copies of [1, 2, 3, 4, 6]) {
    const game = produce(teamRun(42, ["prismram", "emberback", "pollenmoth"]), (draft) => {
      draft.discovery.recruited.prismram = copies;
      draft.phase = "teamSelection";
      draft.battle = null;
    });
    const upgraded = copies >= 3;
    const rank = copies - 1;
    expect(creaturePassive(game, "prismram").rank).toBe(rank);
    expect(actionValue(guard, game.team[0]!, game)).toBe(upgraded ? 3 + rank + 5 : 3);
    const battle = accept(game, { type: "beginBattle" });
    expect(battle.team[0]!.block).toBe(upgraded ? rank + 1 : 0);
    expect(battle.team[0]!.combat!.thorns).toBe(upgraded ? rank + 2 : 0);
    expect(
      enemyAbilityValue({ species: "prismram", damage: 8 }, content.definition(guard.definitionId)),
    ).toBe(4);
  }
});

it("accepts all current six-tier progressions and rejects missing, sparse or repeated effects", () => {
  expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  for (const change of [
    (tiers: content.Species["passiveTiers"]) => Object.assign(tiers, { 3: null }),
    (tiers: content.Species["passiveTiers"]) => Object.assign(tiers, { length: 5 }),
    (tiers: content.Species["passiveTiers"]) => {
      Reflect.deleteProperty(tiers, "3");
    },
    (tiers: content.Species["passiveTiers"]) =>
      Object.assign(tiers, {
        5: {
          description: "Different words cannot create a new effect",
          effects: tiers[0].effects.map((effect) => Object.fromEntries(Object.entries(effect).reverse())),
        },
      }),
  ]) {
    const catalog = structuredClone(contentCatalog);
    change(catalog.species[0]!.passiveTiers);
    expect(validateCatalog(catalog)).toContainEqual(
      expect.objectContaining({
        severity: "error",
        id: catalog.species[0]!.id,
        field: "passiveTiers",
      }),
    );
  }
});

it("rejects reordered composite effects and explicit 100% chance copies as unchanged tiers", () => {
  const catalog = structuredClone(contentCatalog);
  const pollen = catalog.species.find((entry) => entry.id === "pollenmoth")!;
  Object.assign(pollen.passiveTiers, {
    5: {
      description: "Reordered rules with explicit guaranteed chances",
      effects: pollen.passiveTiers[3].effects.map((effect) => ({ chance: 1, ...effect })).reverse(),
    },
  });
  expect(validateCatalog(catalog)).toContainEqual(
    expect.objectContaining({
      id: "pollenmoth",
      field: "passiveTiers",
      message: "Each passive tier must have different effects.",
    }),
  );
});

it.each([0, 1, 2, 3, 4, 5])("applies authored Block retention and Poison retaliation at %i stars", (rank) => {
  const events: GameEvent[] = [];
  produce(teamRun(42, ["mossguard", "captoad", "prismram"]), (game) => {
    for (const unit of game.team) game.discovery.recruited[unit.species] = rank + 1;
    const guard = { ...game.team[0]!, block: 100 };
    expect(retainedBlock(guard, game)).toBe(55 + rank * 5);
    expect(retainedBlock(guard)).toBe(55);
    const toad = game.team[1]!;
    const enemy = game.battle!.enemies[0]!;
    toad.combat!.controlled = "freeze";
    game.rng = 1;
    hit(game, enemy, toad, 1, "burn", events);
    expect(events).toContainEqual(
      expect.objectContaining({ kind: "damage", actorId: toad.id, damageType: "poison", amount: rank + 1 }),
    );
  });
});
