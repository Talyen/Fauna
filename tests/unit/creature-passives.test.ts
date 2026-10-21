import { afterEach, expect, it, vi } from "vitest";
import { produce } from "immer";
import * as content from "../../src/game/content";
import { creaturePassive } from "../../src/game/progression";
import { actionValue, enemyAbilityValue } from "../../src/game/rules";
import { contentCatalog, validateCatalog } from "../../src/game/content-validation";
import { createGame } from "../../src/game/engine";
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
    if (kind !== "stormfin") return original;
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
  const guard = { id: "test", definitionId: "stormfin-guard", ownerId: "ally-0", level: 0 };
  for (const copies of [1, 2, 3, 4, 6]) {
    const game = produce(teamRun(42, ["stormfin", "emberfox", "silkmoth"]), (draft) => {
      draft.discovery.recruited.stormfin = copies;
      draft.phase = "teamSelection";
      draft.battle = null;
    });
    const upgraded = copies >= 3;
    const rank = copies - 1;
    expect(creaturePassive(game, "stormfin").rank).toBe(rank);
    expect(actionValue(guard, game.team[0]!, game)).toBe(upgraded ? 6 + rank + 5 : 6);
    const battle = accept(game, { type: "beginBattle" });
    expect(battle.team[0]!.block).toBe(upgraded ? rank + 1 : 0);
    expect(battle.team[0]!.combat!.thorns).toBe(upgraded ? rank + 2 : 0);
    expect(
      enemyAbilityValue({ species: "stormfin", damage: 8 }, content.definition(guard.definitionId)),
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

it.each([0, 1, 2, 3, 4, 5])("applies the authored card bonuses and opening defenses at %i stars", (rank) => {
  const game = produce(teamRun(42, ["emberfox", "stormfin", "silkmoth"]), (draft) => {
    for (const unit of draft.team) draft.discovery.recruited[unit.species] = rank + 1;
  });
  for (const [definitionId, expected] of [
    ["emberfox-attack", 10 + rank],
    ["stormfin-attack", 8 + rank],
    ["silkmoth-heal", 10 + rank],
  ] as const) {
    const card = game.cards.find((card) => card.definitionId === definitionId)!;
    const actor = game.team.find((unit) => unit.id === card.ownerId)!;
    expect(actionValue(card, actor, game)).toBe(expected);
    if (actor.species === "emberfox") expect(actionValue(card, { ...actor, attacked: true }, game)).toBe(8);
  }
  const ready = produce(teamRun(42, ["briartooth", "moonhart", "captoad"]), (draft) => {
    for (const unit of draft.team) draft.discovery.recruited[unit.species] = rank + 1;
    draft.phase = "teamSelection";
    draft.battle = null;
  });
  const battle = accept(ready, { type: "beginBattle" });
  expect(battle.team[0]!.combat!.thorns).toBe(2 + rank);
  expect(battle.team[1]!.block).toBe(4 + rank);
});
