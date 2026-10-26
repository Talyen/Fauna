import { expect, it } from "vitest";
import { BOONS, definition } from "../../../src/game/content";
import {
  freshCombat,
  grantBlock,
  hit,
  removeEffects,
  removeArmor,
  tickStatuses,
  triggerArmorBreak,
} from "../../../src/game/combat/index";
import { decayBlock } from "../../../src/game/combat/turns";
import { useFood } from "../../../src/game/combat/food";
import { observeDecisions } from "../../../src/game/random";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { requireBattle, teamRun } from "../../support/game";
import { NEW_BOON_EFFECTS } from "../../support/boons";
import prepared from "../../../src/assets/prepared.json";
import type { GameEvent } from "../../../src/game/types";

function fixture() {
  const state = requireBattle(structuredClone(teamRun(42, ["coralcurl", "mossguard", "prismram"])));
  state.boons = [];
  state.talents = [];
  for (const unit of [...state.team, ...state.battle.enemies]) {
    unit.block = 0;
    unit.combat = freshCombat();
  }
  for (const enemy of state.battle.enemies) enemy.health = enemy.maxHealth = 100;
  observeDecisions(state, () => 0.99);
  return { state, ally: state.team[0]!, enemy: state.battle.enemies[0]!, events: [] as GameEvent[] };
}

const ids = [
  "reef-incense-tile",
  "lava-cameo",
  "velvet-whisk",
  "paper-lotus",
  "origami-staircase",
  "wax-foundation-mold",
  "eclipse-rivet",
  "poppy-seed-grinder",
  "peace-knot",
  "coral-music-box",
] as const;
it.each(ids)("%s has the approved rule, artwork and save identity", (id) => {
  const state = requireBattle(structuredClone(teamRun(42, ["coralcurl", "mossguard", "prismram"])));
  state.boons = [id];
  expect(BOONS.find((boon) => boon.id === id)?.text).toBe(NEW_BOON_EFFECTS[id]);
  expect(Object.hasOwn(prepared.records, `boon.${id}`)).toBe(true);
  expect(decodeSave(encodeSave(state)).boons).toEqual([id]);
});

it("preserves a single Thorns stack through retaliation and allows Purge", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["tidecrest-hairpin"];
  ally.combat!.thorns = 1;
  hit(state, enemy, ally, 1, "physical", events);
  expect(ally.combat!.thorns).toBe(1);
  expect(enemy.health).toBe(99);
  removeEffects(ally, "purge", 1, events, state, "thorns", enemy);
  expect(ally.combat!.thorns).toBe(0);
});

it("spreads existing Blind with Water without consuming the original or bypassing Nullify", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["reef-incense-tile"];
  enemy.combat.blind = true;
  const other = state.battle.enemies[1]!;
  other.combat.nullify = true;
  hit(state, ally, enemy, 2, "water", events);
  expect(enemy.combat.blind).toBe(true);
  expect(other.combat.blind).toBe(false);
  expect(other.combat.nullify).toBe(false);
  hit(state, ally, enemy, 2, "water", events);
  expect(other.combat.blind).toBe(true);
});

it("preserves Burn decay only while an enemy has Armor", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["lava-cameo"];
  enemy.combat.burn = 8;
  enemy.combat.statusSources.burn = ally.id;
  enemy.combat.armor = 1;
  tickStatuses(state, enemy, events);
  expect(enemy.combat.burn).toBe(8);
  enemy.combat.armor = 0;
  tickStatuses(state, enemy, events);
  expect(enemy.combat.burn).toBe(4);
});

it("Food grants temporary Dodge to its actual targets", () => {
  const { state, ally, events } = fixture();
  state.boons = ["velvet-whisk", "pumpkin-tureen"];
  useFood(state, definition("food-apple"), ally.id, events);
  expect(state.team.map((unit) => unit.combat!.temporaryDodge)).toEqual([20, 20, 20]);
});

it("halves harmful damage while Nullify lasts", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["paper-lotus"];
  ally.combat!.nullify = true;
  const before = ally.health;
  hit(state, enemy, ally, 6, "poison", events, { origin: "periodic" });
  expect(ally.health).toBe(before - 3);
  ally.combat!.nullify = false;
  hit(state, enemy, ally, 6, "poison", events, { origin: "periodic" });
  expect(ally.health).toBe(before - 9);
});

it("adds Block per armored ally and keeps three quarters on an armored recipient", () => {
  const { state, ally, events } = fixture();
  state.boons = ["origami-staircase", "wax-foundation-mold"];
  ally.combat!.armor = 1;
  state.team[1]!.combat!.armor = 1;
  grantBlock(state, ally, 10, events);
  expect(ally.block).toBe(12);
  decayBlock(state, ally, events);
  expect(ally.block).toBe(9);
});

it("reinforces other allies when Armor actually breaks", () => {
  const { state, ally, events } = fixture();
  state.boons = ["eclipse-rivet"];
  ally.combat!.armor = 2;
  triggerArmorBreak(state, removeArmor(ally, 1).depletion, events);
  expect(state.team.map((unit) => unit.combat!.armor)).toEqual([1, 0, 0]);
  triggerArmorBreak(state, removeArmor(ally, 1).depletion, events);
  expect(state.team.map((unit) => unit.combat!.armor)).toEqual([0, 2, 2]);
});

it("converts Poison damage into Stun buildup without another damage packet", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["poppy-seed-grinder"];
  enemy.block = 10;
  hit(state, ally, enemy, 6, "poison", events);
  expect(enemy.combat.stun).toBe(3);
  expect(enemy.combat.poison).toBe(6);
  expect(events.filter((event) => event.kind === "damage" && event.damageType === "stun")).toHaveLength(0);
});

it("shares Block with other allies when Nullify prevents an effect", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["peace-knot"];
  ally.combat!.nullify = true;
  hit(state, enemy, ally, 2, "poison", events);
  expect(ally.combat!.nullify).toBe(false);
  expect(ally.combat!.poison).toBe(0);
  expect(state.team.map((unit) => unit.block)).toEqual([0, 2, 2]);
});

it("lets Nullify stop the original Poison before adding Stun", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["poppy-seed-grinder"];
  enemy.combat.nullify = true;
  hit(state, ally, enemy, 6, "poison", events);
  expect(enemy.combat.nullify).toBe(false);
  expect(enemy.combat.poison).toBe(0);
  expect(enemy.combat.stun).toBe(3);
});

it("draws an eligible Water card when an ally's Block breaks", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["coral-music-box"];
  const card = state.cards.find((entry) => entry.definitionId === "coralcurl-attack")!;
  for (const zone of ["draw", "discard", "hand", "buffer"] as const)
    state.battle[zone] = state.battle[zone].filter((id) => id !== card.id);
  state.battle.draw.push(card.id);
  ally.block = 2;
  hit(state, enemy, ally, 2, "physical", events);
  expect([...state.battle.hand, ...state.battle.buffer]).toContain(card.id);
});
