import { prepareCombatFixture } from "../../support/combat";
import { expect, it } from "vitest";
import { definition } from "../../../src/game/content";
import {
  applyBlind,
  dodgeChance,
  freshCombat,
  hit,
  removeEffects,
  restoreHealth,
} from "../../../src/game/combat";
import { maximumHealth } from "../../../src/game/combat/state";
import { executeAbility } from "../../../src/game/combat/abilities";
import { useFood } from "../../../src/game/combat/food";
import { swapFromCard } from "../../../src/game/team";
import { requireBattle, run, addReserve } from "../../support/game";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { GameEvent } from "../../../src/game/types";

function fixture() {
  const state = requireBattle(structuredClone(run()));
  prepareCombatFixture(state, "all");
  return {
    state,
    source: state.team[1]!,
    enemy: state.battle.enemies[0]!,
    other: state.battle.enemies[1]!,
    events: [] as GameEvent[],
  };
}

it("lets controlled allies Dodge without extending the benefit to enemies", () => {
  const { state, source, enemy } = fixture();
  source.combat!.controlled = "stun";
  enemy.combat.controlled = "freeze";
  state.boons = ["quiet-pinwheel"];
  expect(dodgeChance(state, source)).toBeGreaterThan(0);
  expect(dodgeChance(state, enemy)).toBe(0);
  state.boons = [];
  expect(dodgeChance(state, source)).toBe(0);
});

it("grants Water Leech while guarded, including damage absorbed by enemy Block", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["lagoon-chalice"];
  source.health -= 8;
  const before = source.health;
  source.block = 3;
  enemy.block = 10;
  const def = { ...definition("prismram-attack"), damageType: "water" as const };
  executeAbility(state, { side: "player", actor: source, def, value: 6, targetId: enemy.id }, events);
  expect(source.health).toBe(before + 3);
  source.block = 0;
  executeAbility(state, { side: "player", actor: source, def, value: 4, targetId: enemy.id }, events);
  expect(source.health).toBe(before + 3);
});

it("sends Stun damage to a neighbor only when the original enemy was already Stunned", () => {
  const { state, source, enemy, other, events } = fixture();
  state.boons = ["acorn-skittle"];
  enemy.combat.controlled = "stun";
  hit(state, source, enemy, 4, "stun", events);
  expect(other.health).toBe(98);
  expect(other.combat.stun).toBe(2);
  enemy.combat.controlled = null;
  hit(state, source, enemy, 4, "stun", events);
  expect(other.health).toBe(98);
});

it("spreads reflected Blind while respecting the other enemy's Nullify", () => {
  const { state, source, enemy, other, events } = fixture();
  state.boons = ["wonder-kaleidoscope"];
  source.combat!.reflect = true;
  other.combat.nullify = true;
  applyBlind(state, enemy, source, events);
  expect(source.combat!.blind).toBe(false);
  expect(enemy.combat.blind).toBe(true);
  expect(other.combat.blind).toBe(false);
  expect(other.combat.nullify).toBe(false);
});

it("shares Nullify in a swap without spending the original ward", () => {
  const { state, source, events } = fixture();
  state.boons = ["welcome-doormat"];
  addReserve(state, "reserve", "emberback", 20, freshCombat());
  const backup = state.reserves.find((unit) => unit.id === "reserve")!;
  source.combat!.nullify = true;
  swapFromCard(state, source, events, true, backup.id);
  expect(source.combat!.nullify).toBe(true);
  expect(backup.combat!.nullify).toBe(true);
});

it("protects other effects through a multi-effect Purge but lets the Block be removed", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["shelter-lantern"];
  source.block = 4;
  source.combat!.armor = 3;
  source.combat!.nullify = true;
  removeEffects(source, "purge", 3, events, state, undefined, enemy);
  expect([source.block, source.combat!.armor, source.combat!.nullify]).toEqual([0, 3, true]);
  removeEffects(source, "purge", 3, events, state, undefined, enemy);
  expect([source.combat!.armor, source.combat!.nullify]).toEqual([0, false]);
});

it("doubles Burn buildup against Block without doubling the original hit", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["chestnut-roaster"];
  enemy.block = 2;
  hit(state, source, enemy, 4, "burn", events);
  expect(enemy.health).toBe(98);
  expect(enemy.combat.burn).toBe(8);
  hit(state, source, enemy, 3, "burn", events);
  expect(enemy.combat.burn).toBe(11);
});

it("turns Bleed into Block only when Health is actually restored", () => {
  const { state, source, events } = fixture();
  state.boons = ["chamomile-compress", "yarrow-salve-tin"];
  source.health -= 6;
  source.combat!.bleed = 4;
  restoreHealth(source, 4, events, false, state);
  expect(source.block).toBe(4);
  expect(source.combat!.bleed).toBe(0);
  source.combat!.bleed = 3;
  source.health = maximumHealth(source);
  restoreHealth(source, 4, events, false, state);
  expect(source.block).toBe(4);
});

it("adds one target to the repeat without repeating self-directed bonuses", () => {
  const { state, source, enemy, other, events } = fixture();
  state.boons = ["cadence-panpipes"];
  state.battle.repeatNext.player = true;
  const def = {
    ...definition("prismram-attack"),
    effects: [
      { kind: "status" as const, status: "thorns" as const, amount: 1 },
      { kind: "purge" as const, amount: 1 },
    ],
  };
  enemy.combat.armor = 1;
  other.combat.armor = 1;
  executeAbility(state, { side: "player", actor: source, def, value: 4, targetId: enemy.id }, events);
  expect(enemy.health).toBe(93);
  expect(other.health).toBe(97);
  expect(source.combat!.thorns).toBe(2);
  expect(other.combat.armor).toBe(0);
});

it("Cleanses the most injured ally once for repeated Food", () => {
  const { state, source, events } = fixture();
  state.boons = ["hearthcap-kettle"];
  state.battle.repeatNext.player = true;
  source.health = 1;
  source.combat!.burn = 3;
  source.combat!.poison = 3;
  useFood(state, definition("food-mana-berries"), undefined, events);
  expect(source.combat!.burn).toBe(0);
  expect(source.combat!.poison).toBe(3);
});

it("preserves all ten Boons through a current-format save", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = [
    "quiet-pinwheel",
    "lagoon-chalice",
    "acorn-skittle",
    "wonder-kaleidoscope",
    "welcome-doormat",
    "shelter-lantern",
    "chestnut-roaster",
    "chamomile-compress",
    "cadence-panpipes",
    "hearthcap-kettle",
  ];
  expect(decodeSave(encodeSave(state)).boons).toEqual(state.boons);
});

it("does not add another hit to repeated area attacks", () => {
  const { state, source, enemy, other, events } = fixture();
  state.boons = ["cadence-panpipes"];
  state.battle.repeatNext.player = true;
  const attack = definition("prismram-attack");
  if (attack.effect !== "attack") throw new Error("Expected an attack");
  const def = { ...attack, target: "allEnemies" as const };
  executeAbility(state, { side: "player", actor: source, def, value: 4 }, events);
  expect(enemy.health).toBe(92);
  expect(other.health).toBe(92);
});
