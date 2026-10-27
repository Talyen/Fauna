import { prepareCombatFixture } from "../../support/combat";
import { expect, it } from "vitest";
import { hit, removeEffects, tickStatuses } from "../../../src/game/combat";
import { useFood } from "../../../src/game/combat/food";
import { definition } from "../../../src/game/content";
import { foodWaffleBenefit } from "../../../src/game/ability-facts";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { observeDecisions } from "../../../src/game/random";
import { accept, bossReward, requireBattle, run } from "../../support/game";
import { produce } from "immer";
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

it("lets an ally Dodge an actual enemy Purge and keeps ordinary Dodge rewards", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["vanishing-hat"];
  state.talents = ["dodge.thornstep"];
  ally.block = 5;
  observeDecisions(state, () => 0);
  removeEffects(ally, "purge", 1, events, state, undefined, enemy);
  expect(ally.block).toBe(5);
  expect(ally.combat!.thorns).toBe(1);
  expect(events.some((event) => event.kind === "status" && event.outcome === "dodge")).toBe(true);
});

it("shelters backup from periodic damage while effects still expire", () => {
  const { state, ally, events } = fixture();
  state.boons = ["rocking-chair-charm"];
  state.team.splice(0, 1);
  state.reserves.push(ally);
  ally.combat!.burn = 4;
  ally.combat!.poison = 5;
  ally.combat!.bleed = 3;
  const before = ally.health;
  tickStatuses(state, ally, events);
  expect(ally.health).toBe(before);
  expect([ally.combat!.burn, ally.combat!.poison, ally.combat!.bleed]).toEqual([2, 4, 0]);
});

it("uses Stun efficiently against enemy Block without doubling buildup", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["asteroid-hammer"];
  enemy.block = 8;
  hit(state, ally, enemy, 6, "stun", events);
  expect(enemy.block).toBe(5);
  expect(enemy.health).toBe(100);
  expect(enemy.combat.stun).toBe(6);
});

it("silences already Frozen enemy Thorns but not the hit that Freezes", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["snowbell"];
  enemy.combat.thorns = 3;
  const before = ally.health;
  hit(state, ally, enemy, 60, "freeze", events);
  expect(enemy.combat.controlled).toBe("freeze");
  expect(ally.health).toBe(before - 3);
  const after = ally.health;
  hit(state, ally, enemy, 1, "physical", events);
  expect(ally.health).toBe(after);
  expect(enemy.combat.thorns).toBe(2);
});

it("sends direct Bleed and its later tick past enemy Block", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["harvest-sickle"];
  enemy.block = 8;
  hit(state, ally, enemy, 4, "bleed", events);
  expect([enemy.health, enemy.block, enemy.combat.bleed]).toEqual([96, 8, 4]);
  tickStatuses(state, enemy, events);
  expect([enemy.health, enemy.block, enemy.combat.bleed]).toEqual([92, 8, 0]);
});

it("releases Poison on a successful Purge without consuming its stacks", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["meadow-mortar"];
  enemy.block = 5;
  enemy.combat.poison = 4;
  removeEffects(enemy, "purge", 1, events, state, undefined, ally);
  expect([enemy.health, enemy.combat.poison]).toEqual([96, 4]);
  removeEffects(enemy, "purge", 1, events, state, undefined, ally);
  expect(enemy.health).toBe(96);
});

it("applies Bleed through ordinary allied Thorns retaliation", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["rosewax-seal"];
  ally.combat!.thorns = 3;
  hit(state, enemy, ally, 2, "physical", events);
  expect(enemy.health).toBe(97);
  expect(enemy.combat.bleed).toBe(1);
  expect(ally.combat!.thorns).toBe(2);
});

it("makes Freeze attacks against Burning enemies unavoidable", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["solstice-concertina"];
  enemy.combat.burn = 1;
  observeDecisions(state, () => 0);
  hit(state, ally, enemy, 3, "freeze", events);
  expect(enemy.health).toBeLessThan(100);
  expect(enemy.combat.freeze).toBeGreaterThan(0);
});

it("heals Food recipients using their Block after the Food resolves", () => {
  const { state, ally, events } = fixture();
  state.boons = ["crown-waffle-iron"];
  ally.health -= 15;
  const before = ally.health;
  useFood(state, definition("food-trail-bread"), ally.id, events);
  expect(ally.block).toBe(6);
  expect(ally.health).toBe(before + 6);
});

it("accounts for Waffle Iron when assessing Food", () => {
  const { state, ally } = fixture();
  state.boons = ["crown-waffle-iron"];
  ally.health -= 15;
  expect(foodWaffleBenefit(state, definition("food-trail-bread"), ally, 6)).toBe(6);
  expect(foodWaffleBenefit(state, definition("food-mana-berries"), ally, 2)).toBe(0);
});

it("gives the deployed team Thorns when allied Armor breaks", () => {
  const { state, ally, other, enemy, events } = fixture();
  state.boons = ["beeswax-crown"];
  ally.combat!.armor = 1;
  hit(state, enemy, ally, 3, "physical", events);
  expect(ally.combat!.armor).toBe(0);
  expect([ally.combat!.thorns, other.combat!.thorns]).toEqual([2, 2]);
});

it("grants surviving allies Thorns when the Armor-breaking hit knocks its wearer out", () => {
  const { state, ally, other, enemy, events } = fixture();
  state.boons = ["beeswax-crown"];
  ally.health = 1;
  ally.combat!.deathDoorUsed = true;
  ally.combat!.armor = 1;
  hit(state, enemy, ally, 3, "physical", events);
  expect(ally.health).toBe(0);
  expect(other.combat!.thorns).toBe(2);
});

it("does not treat a Dodged Purge as a Dodged attack", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["vanishing-hat", "fern-fencing-foil"];
  ally.block = 5;
  enemy.block = 7;
  observeDecisions(state, () => 0);
  removeEffects(ally, "purge", 1, events, state, undefined, enemy);
  expect([ally.block, enemy.block]).toEqual([5, 7]);
});

it("combines Thorns Bleed with Thornheart Ring without spending the protected stack", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["rosewax-seal", "thornheart-ring"];
  ally.combat!.thorns = 3;
  hit(state, enemy, ally, 1, "physical", events);
  hit(state, enemy, ally, 1, "physical", events);
  expect(ally.combat!.thorns).toBe(2);
  expect(enemy.combat.bleed).toBe(2);
});

it("resumes a battle with all ten owned Boons", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = [
    "vanishing-hat",
    "rocking-chair-charm",
    "asteroid-hammer",
    "snowbell",
    "harvest-sickle",
    "meadow-mortar",
    "rosewax-seal",
    "solstice-concertina",
    "crown-waffle-iron",
    "beeswax-crown",
  ];
  expect(decodeSave(encodeSave(state))).toEqual(state);
});

it("commits an offered new Boon when the player chooses it", () => {
  const offered = produce(bossReward(), (draft) => {
    draft.reward!.boons = ["rosewax-seal"];
  });
  const chosen = accept(offered, { type: "chooseBoon", boon: "rosewax-seal" });
  expect(chosen.boons).toContain("rosewax-seal");
  expect(decodeSave(encodeSave(chosen))).toEqual(chosen);
});
