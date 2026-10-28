import { expect, it } from "vitest";
import { prepareCombatFixture } from "../../support/combat";
import { addReserve, requireBattle, run } from "../../support/game";
import { NEW_BOON_EFFECTS } from "../../support/boons";
import { applyHarmfulStatus, hit, removeEffects } from "../../../src/game/combat";
import { executeAbility } from "../../../src/game/combat/abilities";
import { useFood } from "../../../src/game/combat/food";
import { BOONS, definition } from "../../../src/game/content";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { swapFromCard } from "../../../src/game/team";
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

it("Food heals living backup allies and Cleanses deployed Burn including Mana Berries", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["orchard-ladder-charm", "spore-trivet"];
  addReserve(state, "backup", "captoad", 1);
  const backup = state.reserves[0]!;
  state.battle.repeatNext.player = true;
  applyHarmfulStatus(state, enemy, ally, 3, "burn", events);
  useFood(state, definition("food-mana-berries"), undefined, events);
  expect(backup.health).toBe(7);
  expect(ally.combat!.burn).toBe(0);
  expect(
    events.some((event) => event.kind === "status" && event.status === "cleanse" && event.amount === 0),
  ).toBe(false);
});

it("restores Mana on an allied defeat and not on a nonfatal hit", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["victory-laurel"];
  state.battle.mana = 0;
  enemy.health = 4;
  hit(state, ally, enemy, 1, "physical", events, { origin: "ability", blindMiss: false });
  expect(state.battle.mana).toBe(0);
  hit(state, ally, enemy, 10, "physical", events, { origin: "ability", blindMiss: false });
  expect(state.battle.mana).toBe(1);
});

it("steals Armor on a landed Physical hit and grants Block to other allies", () => {
  const { state, ally, other, enemy, events } = fixture();
  state.boons = ["gilt-gauntlet", "orbit-tongs"];
  enemy.combat.armor = 3;
  hit(state, ally, enemy, 2, "physical", events, { origin: "ability", blindMiss: false });
  expect(ally.combat!.armor).toBe(1);
  expect(other.block).toBe(2);
  enemy.combat.armor = 0;
  hit(state, ally, enemy, 2, "physical", events, { origin: "ability", blindMiss: false });
  expect(other.block).toBe(2);
});

it("rewards existing Armor theft on Dodge", () => {
  const { state, ally, other, enemy, events } = fixture();
  state.boons = ["skyiron-horseshoe", "orbit-tongs"];
  ally.combat!.dodge = 70;
  enemy.combat.armor = 2;
  observeDecisions(state, () => 0);
  hit(state, enemy, ally, 2, "physical", events, { origin: "ability", blindMiss: false });
  expect(ally.combat!.armor).toBe(1);
  expect(other.block).toBe(2);
});

it("Blinds the living source of Cleansed Burn through normal status protection", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["pumice-glass-inkwell"];
  applyHarmfulStatus(state, enemy, ally, 3, "burn", events);
  enemy.combat.nullify = true;
  removeEffects(ally, "cleanse", 1, events, state, "burn");
  expect(enemy.combat.blind).toBe(false);
  expect(enemy.combat.nullify).toBe(false);
  applyHarmfulStatus(state, enemy, ally, 3, "burn", events);
  removeEffects(ally, "cleanse", 1, events, state, "burn");
  expect(enemy.combat.blind).toBe(true);
});

it("adds Burn and grants Reflect on landed Stun hits, including a finishing hit", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["chime-crucible", "crystal-harp"];
  hit(state, ally, enemy, 2, "stun", events, { origin: "ability", blindMiss: false });
  expect(enemy.combat.burn).toBe(1);
  expect(ally.combat!.reflect).toBe(true);
  ally.combat!.reflect = false;
  enemy.health = 1;
  hit(state, ally, enemy, 10, "stun", events, { origin: "ability", blindMiss: false });
  expect(ally.combat!.reflect).toBe(true);
});

it("Cleanses all harmful effects from a resurrected backup ally", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["memory-cairn"];
  addReserve(state, "backup", "captoad", 1);
  const backup = state.reserves[0]!;
  applyHarmfulStatus(state, enemy, backup, 3, "burn", events);
  applyHarmfulStatus(state, enemy, backup, 3, "poison", events);
  backup.health = 0;
  executeAbility(
    state,
    {
      side: "player",
      actor: ally,
      def: definition("oathara-vow-of-return"),
      value: 1,
      allyTargetId: backup.id,
    },
    events,
    { swap: swapFromCard },
  );
  expect(backup.health).toBeGreaterThan(0);
  expect([backup.combat!.burn, backup.combat!.poison]).toEqual([0, 0]);
});

it("lets Light hit through Blind while retaining Blind for a later Physical attack", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["vow-candle"];
  ally.combat!.blind = true;
  observeDecisions(state, () => 0.99);
  const health = enemy.health;
  hit(state, ally, enemy, 4, "light", events, { origin: "ability" });
  expect(enemy.health).toBeLessThan(health);
  expect(ally.combat!.blind).toBe(true);
  hit(state, ally, enemy, 4, "physical", events, { origin: "ability" });
  expect(ally.combat!.blind).toBe(false);
});

it("preserves Blind during a Light ability and leaves normal enemy defenses active", () => {
  const { state, enemy, events } = fixture();
  const ally = state.team[2]!;
  state.boons = ["vow-candle"];
  ally.combat!.blind = true;
  enemy.combat.negate = true;
  executeAbility(
    state,
    { side: "player", actor: ally, def: definition("prismram-spectrum-lance"), value: 4, targetId: enemy.id },
    events,
    { swap: swapFromCard },
  );
  expect(ally.combat!.blind).toBe(true);
  expect(enemy.combat.negate).toBe(false);
  expect(enemy.health).toBe(100);
});

it("preserves the new Boon selection across save and resume", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = [
    "orchard-ladder-charm",
    "spore-trivet",
    "victory-laurel",
    "gilt-gauntlet",
    "pumice-glass-inkwell",
    "chime-crucible",
    "crystal-harp",
    "orbit-tongs",
    "memory-cairn",
    "vow-candle",
  ];
  expect(decodeSave(encodeSave(state))).toEqual(state);
  for (const id of state.boons) {
    expect(BOONS.find((boon) => boon.id === id)?.text).toBe(
      Object.entries(NEW_BOON_EFFECTS).find(([key]) => key === id)?.[1],
    );
  }
});
