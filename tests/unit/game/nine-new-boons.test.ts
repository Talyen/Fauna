import { expect, it } from "vitest";
import { BOONS, definition } from "../../../src/game/content";
import { freshCombat, grantArmor, hit, removeEffects, tickStatuses } from "../../../src/game/combat/index";
import { executeAbility } from "../../../src/game/combat/abilities";
import { useFood } from "../../../src/game/combat/food";
import { swapFromCard } from "../../../src/game/team";
import { observeDecisions } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import prepared from "../../../src/assets/prepared.json";
import { requireBattle, run, addReserve } from "../../support/game";
import { NEW_BOON_EFFECTS } from "../../support/boons";
import type { GameEvent } from "../../../src/game/types";

const ids = [
  "aether-gramophone",
  "herbarium-press",
  "honey-press",
  "rook-of-mercy",
  "tidecrest-hairpin",
  "stardust-whetstone",
  "ashfall-pendant",
  "wishing-building-block",
  "sovereign-toast-rack",
] as const;
function fixture() {
  const state = requireBattle(structuredClone(run()));
  state.boons = [];
  state.talents = [];
  for (const unit of [...state.team, ...state.battle.enemies]) {
    unit.block = 0;
    unit.combat = freshCombat();
  }
  observeDecisions(state, () => 0.99);
  return { state, ally: state.team[0]!, enemy: state.battle.enemies[0]!, events: [] as GameEvent[] };
}

it.each(ids)("registers %s with its artwork and save identity", (id) => {
  const { state } = fixture();
  state.boons = [id];
  expect(BOONS.find((boon) => boon.id === id)?.text).toBe(NEW_BOON_EFFECTS[id]);
  expect(Object.hasOwn(prepared.records, `boon.${id}`)).toBe(true);
  expect(decodeSave(encodeSave(state)).boons).toEqual([id]);
});

it("makes a repeated attack reliable without making the first attack reliable", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["aether-gramophone"];
  state.battle.repeatNext.player = true;
  enemy.health = enemy.maxHealth = 100;
  enemy.combat.dodge = 70;
  observeDecisions(state, () => 0);
  const def = definition("prismram-attack");
  executeAbility(state, { side: "player", actor: ally, def, value: 4, targetId: enemy.id }, events, {
    swap: swapFromCard,
  });
  expect(events.filter((event) => event.kind === "status" && event.outcome === "dodge")).toHaveLength(1);
  expect(enemy.health).toBeLessThan(100);
});

it("does not make a reflected repeated attack impossible for the ally to Dodge", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["aether-gramophone"];
  ally.combat!.dodge = 70;
  enemy.combat.attackReflection = true;
  observeDecisions(state, () => 0);
  const health = ally.health;
  hit(state, ally, enemy, 4, "physical", events, { origin: "ability", cannotDodge: true });
  expect(ally.health).toBe(health);
  expect(
    events.some(
      (event) => event.kind === "status" && event.outcome === "dodge" && event.targetId === ally.id,
    ),
  ).toBe(true);
});

it("protects only Poison on Frozen enemies from Cleanse", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["herbarium-press"];
  enemy.combat.controlled = "freeze";
  enemy.combat.controlTurns = 1;
  enemy.combat.poison = 5;
  enemy.combat.burn = 3;
  removeEffects(enemy, "cleanse", 3, events, state, undefined, enemy);
  expect(enemy.combat.poison).toBe(5);
  expect(enemy.combat.burn).toBe(0);
  ally.combat!.poison = 4;
  removeEffects(ally, "cleanse", 1, events, state, "poison", ally);
  expect(ally.combat!.poison).toBe(0);
});

it("heals for actual enemy Block purged, including linked Purge", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["honey-press", "pattern-reel"];
  ally.health = 1;
  enemy.block = 8;
  state.battle.enemies[1]!.block = 4;
  removeEffects(enemy, "purge", 1, events, state, undefined, ally);
  expect(ally.health).toBe(7);
  expect(enemy.block).toBe(0);
  expect(state.battle.enemies[1]!.block).toBe(0);
});

it("grants Armor to both allies exchanging positions and Block to other armored allies", () => {
  const { state, ally, events } = fixture();
  state.boons = ["rook-of-mercy", "wishing-building-block"];
  const other = state.team[1]!;
  const third = state.team[2]!;
  other.combat!.armor = 1;
  third.combat!.armor = 1;
  const incoming = swapFromCard(state, ally, events)!;
  const remaining = incoming.id === other.id ? third : other;
  expect(ally.combat!.armor).toBe(2);
  expect(incoming.combat!.armor).toBe(3);
  expect(remaining.block).toBe(2);
  grantArmor(state, ally, 1, events);
  expect(remaining.block).toBe(3);
});

it("grants Armor to a living backup arriving through a swap", () => {
  const { state, ally, events } = fixture();
  state.boons = ["rook-of-mercy"];
  addReserve(state, "backup", "captoad", 20, freshCombat());
  swapFromCard(state, ally, events, true, "backup");
  expect(state.team.find((unit) => unit.id === "backup")!.combat!.armor).toBe(2);
});

it("retains the last Water Thorns through retaliation but allows Purge", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["tidecrest-hairpin"];
  ally.combat!.waterThorns = 1;
  hit(state, enemy, ally, 2, "physical", events, { origin: "ability", blindMiss: false });
  expect(ally.combat!.waterThorns).toBe(1);
  removeEffects(ally, "purge", 1, events, state, "waterThorns", enemy);
  expect(ally.combat!.waterThorns).toBe(0);
});

it("applies Bleed on a blocked Physical hit against Armor through normal Nullify", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["stardust-whetstone"];
  enemy.block = 20;
  enemy.combat.armor = 3;
  hit(state, ally, enemy, 5, "physical", events, { origin: "proc" });
  expect(enemy.combat.bleed).toBe(1);
  enemy.combat.nullify = true;
  hit(state, ally, enemy, 5, "physical", events, { origin: "proc" });
  expect(enemy.combat.bleed).toBe(1);
  expect(enemy.combat.nullify).toBe(false);
});

it("removes Block equal to actual enemy Burn decay", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["ashfall-pendant"];
  enemy.health = enemy.maxHealth = 100;
  enemy.block = 20;
  enemy.combat.burn = 6;
  enemy.combat.statusSources.burn = ally.id;
  tickStatuses(state, enemy, events);
  expect([enemy.block, enemy.combat.burn]).toEqual([11, 3]);
});

it("grants Armor once per Food play even when Food repeats", () => {
  const { state, events } = fixture();
  state.boons = ["sovereign-toast-rack"];
  state.battle.repeatNext.player = true;
  useFood(state, definition("food-mana-berries"), undefined, events);
  expect(state.team.map((ally) => ally.combat!.armor)).toEqual([2, 2, 2]);
});
