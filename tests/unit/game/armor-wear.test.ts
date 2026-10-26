import { expect, it } from "vitest";
import { freshCombat, hit } from "../../../src/game/combat/index";
import { run } from "../../support/game";
import type { GameEvent } from "../../../src/game/types";

function fixture() {
  const state = structuredClone(run());
  state.boons = [];
  state.talents = [];
  const ally = state.team[0]!;
  const enemy = state.battle!.enemies[0]!;
  ally.health = enemy.health = 30;
  ally.block = enemy.block = 0;
  ally.combat = freshCombat();
  enemy.combat = freshCombat();
  const events: GameEvent[] = [];
  return { state, ally, enemy, events };
}

it("wears Armor only when it actually reduces damage", () => {
  const { state, ally, enemy, events } = fixture();
  enemy.combat.armor = 3;
  enemy.block = 10;
  hit(state, ally, enemy, 5, "physical", events, { origin: "proc" });
  expect([enemy.health, enemy.block, enemy.combat.armor]).toEqual([30, 5, 3]);
  hit(state, ally, enemy, 7, "physical", events, { origin: "proc" });
  expect([enemy.health, enemy.block, enemy.combat.armor]).toEqual([30, 0, 2]);
  hit(state, ally, enemy, 5, "water", events, { origin: "proc" });
  expect([enemy.health, enemy.combat.armor]).toEqual([25, 2]);
  hit(state, ally, enemy, 5, "physical", events, { origin: "proc" });
  expect([enemy.health, enemy.combat.armor]).toEqual([22, 1]);
});

it("keeps Armor-first mitigation, bypass, and explicit erosion distinct", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["hoard-lockplate", "tuning-fork-charm"];
  ally.combat!.armor = 3;
  ally.block = 10;
  hit(state, enemy, ally, 5, "physical", events, { origin: "proc" });
  expect([ally.health, ally.block, ally.combat!.armor]).toEqual([30, 8, 2]);
  enemy.combat.armor = 5;
  enemy.combat.stun = 1;
  hit(state, ally, enemy, 4, "physical", events, { origin: "proc" });
  expect([enemy.health, enemy.combat.armor]).toEqual([26, 5]);
  state.talents = ["poison.caustic"];
  enemy.block = 10;
  hit(state, ally, enemy, 3, "poison", events, { origin: "proc" });
  expect([enemy.block, enemy.combat.armor]).toEqual([7, 2]);
});

it("Rain Cape improves allied Block against Water without changing enemy Block", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["rain-cape"];
  ally.block = enemy.block = 3;
  ally.combat!.armor = enemy.combat.armor = 2;
  hit(state, enemy, ally, 5, "water", events, { origin: "proc" });
  hit(state, ally, enemy, 5, "water", events, { origin: "proc" });
  expect([ally.health, ally.block, ally.combat!.armor]).toEqual([30, 0, 2]);
  expect([enemy.health, enemy.block, enemy.combat.armor]).toEqual([28, 0, 2]);
});
