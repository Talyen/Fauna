import { expect, it } from "vitest";
import { prepareCombatFixture } from "../../support/combat";
import { requireBattle, run } from "../../support/game";
import { applyHarmfulStatus, grantStatus, hit, restoreHealth, tickStatuses } from "../../../src/game/combat";
import { executeAbility } from "../../../src/game/combat/abilities";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { definition } from "../../../src/game/content";
import { swapFromCard } from "../../../src/game/team";
import { combatStatuses } from "../../../src/ui/shared/combat/combat-status-model";
import { maximumHealth } from "../../../src/game/combat/state";
import { observeDecisions } from "../../../src/game/random";
import type { GameEvent } from "../../../src/game/types";

function fixture() {
  const state = requireBattle(structuredClone(run()));
  prepareCombatFixture(state, "all");
  return {
    state,
    ally: state.team[0]!,
    other: state.team[1]!,
    enemy: state.battle.enemies[0]!,
    events: [] as GameEvent[],
  };
}

it("spreads Burn hits through normal protection and removes Thorns after retaliation and ticks", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["ember-platter", "ash-bowl"];
  const other = state.battle.enemies[1]!;
  enemy.combat.thorns = 4;
  const health = ally.health;
  hit(state, ally, enemy, 3, "burn", events, { origin: "ability" });
  expect(ally.health).toBe(health - 4);
  expect(enemy.combat.thorns).toBe(2);
  expect(other.combat.burn).toBe(1);
  tickStatuses(state, enemy, events);
  expect(enemy.combat.thorns).toBe(1);
});

it("passes actual Thorns gain to the least protected ally without recursion", () => {
  const { state, ally, other, events } = fixture();
  state.boons = ["mossball"];
  state.team[2]!.combat!.thorns = 3;
  grantStatus(ally, "thorns", 2, events, state);
  expect([ally.combat!.thorns, other.combat!.thorns, state.team[2]!.combat!.thorns]).toEqual([2, 1, 3]);
});

it("steals Armor on an attack Dodge, preserving Armor break reactions", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["skyiron-horseshoe"];
  ally.combat!.dodge = 70;
  enemy.combat.armor = 1;
  observeDecisions(state, () => 0);
  hit(state, enemy, ally, 3, "physical", events, { origin: "ability", blindMiss: false });
  expect([enemy.combat.armor, ally.combat!.armor]).toEqual([0, 1]);
});

it("uses Armor against Poison without wearing it", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["nebula-weld-clamp"];
  ally.combat!.armor = 3;
  const health = ally.health;
  hit(state, enemy, ally, 5, "poison", events, { origin: "periodic" });
  expect([ally.health, ally.combat!.armor]).toEqual([health - 2, 3]);
});

it("adds healing per distinct harmful effect and does not count control twice", () => {
  const { state, ally, events } = fixture();
  state.boons = ["clover-measuring-scoop"];
  ally.health = 1;
  ally.combat!.poison = 2;
  ally.combat!.stun = 3;
  ally.combat!.controlled = "stun";
  ally.combat!.controlTurns = 1;
  restoreHealth(ally, 2, events, false, state);
  expect(ally.health).toBe(7);
});

it("prevents Thorns retaliation only when both attacker and enemy have Thorns", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["treaty-teapot"];
  ally.combat!.thorns = 1;
  enemy.combat.thorns = 3;
  const health = ally.health;
  hit(state, ally, enemy, 2, "physical", events, { origin: "ability" });
  expect(ally.health).toBe(health);
  expect(enemy.combat.thorns).toBe(3);
});

it("Cleanses Stun from other allies when an ally is Stunned", () => {
  const { state, ally, other, enemy, events } = fixture();
  state.boons = ["dawn-gong"];
  other.combat!.stun = 5;
  applyHarmfulStatus(state, enemy, ally, 100, "stun", events);
  expect(ally.combat!.controlled).toBe("stun");
  expect(other.combat!.stun).toBe(0);
});

it("prepares the Dodging ally's next attack without protecting it from Blind", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["acrobat-top"];
  ally.combat!.dodge = 70;
  enemy.combat.dodge = 70;
  observeDecisions(state, () => 0);
  hit(state, enemy, ally, 2, "physical", events, { origin: "ability", blindMiss: false });
  expect(ally.combat!.acrobatReady).toBe(true);
  const def = definition("prismram-attack");
  executeAbility(state, { side: "player", actor: ally, def, value: 4, targetId: enemy.id }, events, {
    swap: swapFromCard,
  });
  expect(enemy.health).toBeLessThan(100);
  expect(ally.combat!.acrobatReady).toBe(false);
});

it("grants Negate to a resurrected ally", () => {
  const { state, ally, other, events } = fixture();
  state.boons = ["remembrance-wreath"];
  other.health = 0;
  const def = definition("oathara-vow-of-return");
  executeAbility(state, { side: "player", actor: ally, def, value: 1, allyTargetId: other.id }, events, {
    swap: swapFromCard,
  });
  expect(other.health).toBeGreaterThan(0);
  expect(other.combat!.negate).toBe(true);
});

it("lets Blind defeat Acrobat Top's prepared attack", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["acrobat-top"];
  ally.combat!.acrobatReady = true;
  ally.combat!.blind = true;
  observeDecisions(state, () => 0);
  const def = definition("prismram-attack");
  executeAbility(state, { side: "player", actor: ally, def, value: 4, targetId: enemy.id }, events, {
    swap: swapFromCard,
  });
  expect(enemy.health).toBe(100);
  expect(ally.combat!.acrobatReady).toBe(false);
});

it("adds the scoop's bonus to healing shared by Overflow Cup", () => {
  const { state, ally, other, events } = fixture();
  state.boons = ["clover-measuring-scoop", "overflow-cup"];
  ally.health = maximumHealth(ally) - 1;
  other.health = 1;
  other.combat!.poison = 2;
  restoreHealth(ally, 7, events, false, state);
  expect(other.health).toBe(6);
});

it("preserves all new Boons and Acrobat preparation across save and resume", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = [
    "ember-platter",
    "ash-bowl",
    "mossball",
    "skyiron-horseshoe",
    "nebula-weld-clamp",
    "clover-measuring-scoop",
    "treaty-teapot",
    "dawn-gong",
    "acrobat-top",
    "remembrance-wreath",
  ];
  state.team[0]!.combat!.acrobatReady = true;
  expect(decodeSave(encodeSave(state))).toEqual(state);
});

it("shows Acrobat preparation on the creature until it is spent", () => {
  const { ally } = fixture();
  ally.combat!.acrobatReady = true;
  expect(combatStatuses(ally.combat).find((status) => status.id === "acrobatReady")?.text).toBe(
    "Acrobat Top: next attack cannot be Dodged",
  );
  ally.combat!.acrobatReady = false;
  expect(combatStatuses(ally.combat).some((status) => status.id === "acrobatReady")).toBe(false);
});
