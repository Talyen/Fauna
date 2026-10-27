import { expect, it } from "vitest";
import { freshCombat, hit, removeEffects, restoreHealth, tickStatuses } from "../../../src/game/combat";
import { decayBlock, finishTurn } from "../../../src/game/combat/turns";
import { useFood } from "../../../src/game/combat/food";
import { definition } from "../../../src/game/content";
import { BOONS } from "../../../src/game/content";
import { validateContent } from "../../../src/game/content-validation";
import prepared from "../../../src/assets/prepared.json";
import { cardText } from "../../../src/game/card-rules";
import { executeAbility } from "../../../src/game/combat/abilities";
import { swapFromCard } from "../../../src/game/team";
import { dispatch } from "../../../src/game/engine";
import { produce } from "immer";
import { replenishJourneyCards, CORNUCOPIA_CARD_ID } from "../../../src/game/journey-cards";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { observeDecisions } from "../../../src/game/random";
import { accept, bossReward, requireBattle, run, winBattle } from "../../support/game";
import { setBattleCards } from "../../support/cards";
import type { GameEvent } from "../../../src/game/types";

it("registers all ten rules and selected portraits", () => {
  for (const id of [
    "overflow-cup",
    "ripple-mirror",
    "sail-needle",
    "rootspool",
    "winterseed",
    "moonpath-divider",
    "cornucopia",
    "suncrust-rolling-pin",
    "dandelion-poultice",
    "dew-pendulum",
  ]) {
    expect(BOONS.some((boon) => boon.id === id)).toBe(true);
    expect(Object.hasOwn(prepared.records, `boon.${id}`)).toBe(true);
  }
  expect(validateContent).not.toThrow();
});

function fixture() {
  const state = requireBattle(structuredClone(run()));
  state.talents = [];
  state.boons = [];
  for (const ally of state.team) {
    ally.combat = freshCombat();
    ally.block = 0;
  }
  for (const enemy of state.battle.enemies) {
    enemy.combat = freshCombat();
    enemy.health = enemy.maxHealth = 100;
    enemy.block = 0;
  }
  observeDecisions(state, () => 0.99);
  return {
    state,
    ally: state.team[0]!,
    other: state.team[1]!,
    enemy: state.battle.enemies[0]!,
    second: state.battle.enemies[1]!,
    events: [] as GameEvent[],
  };
}

it("shares excess healing once with the most injured other ally", () => {
  const { state, ally, other, events } = fixture();
  state.boons = ["overflow-cup"];
  other.health -= 10;
  const before = other.health;
  restoreHealth(ally, 8, events, false, state);
  expect(other.health).toBe(before + 4);
});

it("sends a reflected attack to the other enemies as well", () => {
  const { state, ally, enemy, second, events } = fixture();
  state.boons = ["ripple-mirror"];
  ally.combat!.attackReflection = true;
  hit(state, enemy, ally, 4, "physical", events);
  expect(enemy.health).toBe(96);
  expect(second.health).toBe(96);
});

it("spreads a reflected authored ability as well as its damage packets", () => {
  const { state, ally, enemy, second, events } = fixture();
  state.boons = ["ripple-mirror"];
  ally.combat!.attackReflection = true;
  const def = { ...definition("emberback-attack"), effects: [{ kind: "blind" as const, amount: 1 }] };
  executeAbility(state, { side: "enemy", actor: enemy, def, value: 4, targetId: ally.id }, events, {
    swap: swapFromCard,
  });
  expect(enemy.health).toBe(96);
  expect(second.health).toBe(96);
  expect([enemy.combat.blind, second.combat.blind]).toEqual([true, true]);
});

it("mends Cleansed Bleed and scatters damage only for an actual Cleanse", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["sail-needle", "dandelion-poultice"];
  ally.combat!.bleed = 3;
  removeEffects(ally, "cleanse", 1, events, state);
  expect(ally.combat!.armor).toBe(2);
  expect(enemy.health).toBe(98);
  removeEffects(ally, "cleanse", 1, events, state);
  expect(enemy.health).toBe(98);
});

it("triggers Dandelion Poultice for partial and full Mask Cleanses without category healing on partial removal", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["plague-doctors-mask", "dandelion-poultice", "sin-eaters-lantern"];
  ally.health -= 10;
  ally.combat!.poison = 5;
  const before = ally.health;
  tickStatuses(state, ally, events);
  expect(enemy.health).toBe(97); // Poultice and the Mask's Poison damage
  expect(events.filter((event) => event.kind === "heal" && event.targetId === ally.id)).toHaveLength(0);
  expect(ally.health).toBeLessThan(before);

  ally.combat!.poison = 1;
  const health = enemy.health;
  tickStatuses(state, ally, events);
  expect(enemy.health).toBe(health - 3);
  expect(events.some((event) => event.kind === "heal" && event.targetId === ally.id)).toBe(true);
});

it("allows actual allied Thorns damage to Leech through Block", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["rootspool"];
  ally.health -= 5;
  const before = ally.health;
  ally.combat!.thorns = 4;
  enemy.block = 4;
  hit(state, enemy, ally, 1, "physical", events);
  expect(ally.health).toBe(before + 1);
  expect(enemy.block).toBe(0);
});

it("retains a Frozen ally's Block without changing enemy decay", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["winterseed"];
  ally.block = enemy.block = 8;
  ally.combat!.controlled = enemy.combat.controlled = "freeze";
  decayBlock(state, ally, events);
  decayBlock(state, enemy, events);
  expect(ally.block).toBe(8);
  expect(enemy.block).toBe(4);
});

it("spreads Freeze buildup without dealing another hit", () => {
  const { state, ally, enemy, second, events } = fixture();
  state.boons = ["moonpath-divider"];
  hit(state, ally, enemy, 6, "freeze", events);
  expect(enemy.combat.freeze).toBe(6);
  expect(second.combat.freeze).toBe(3);
  expect(second.health).toBe(100);
});

it("keeps the journey's Mana Berries through deck reconstruction and uses them to feed allies", () => {
  const { state, ally, other, events } = fixture();
  state.boons = ["cornucopia"];
  const saved = requireBattle(structuredClone(run()));
  saved.boons = ["cornucopia"];
  replenishJourneyCards(saved);
  setBattleCards(saved, saved.battle.hand);
  expect(decodeSave(encodeSave(saved)).cards.some((card) => card.id === CORNUCOPIA_CARD_ID)).toBe(true);
  ally.health -= 5;
  other.health -= 5;
  const health = [ally.health, other.health];
  useFood(state, definition("food-mana-berries"), undefined, events);
  expect([ally.health, other.health]).toEqual(health.map((value) => value + 2));
  state.boons.push("nectar-dipper");
  expect(cardText(definition("food-mana-berries"), 0, 4, 1, state)).toContain(
    "Restore 4 Health to all allies",
  );
  useFood(state, definition("food-mana-berries"), undefined, events);
  expect([ally.health, other.health]).toEqual(health.map((value) => value + 5));
});

it("adds the berries to the journey deck on selection and restores them after consumption", () => {
  const offered = produce(bossReward(), (draft) => {
    draft.reward!.boons = ["cornucopia"];
  });
  const chosen = accept(offered, { type: "chooseBoon", boon: "cornucopia" });
  expect(decodeSave(encodeSave(chosen)).cards.some((card) => card.id === CORNUCOPIA_CARD_ID)).toBe(true);
  const battle = requireBattle(structuredClone(accept(chosen, { type: "beginBattle" })));
  setBattleCards(battle, [CORNUCOPIA_CARD_ID]);
  const played = dispatch(battle, { type: "play", cardId: CORNUCOPIA_CARD_ID, autoEndTurn: false });
  expect(played.accepted).toBe(true);
  if (!played.accepted) return;
  expect(decodeSave(encodeSave(played.state)).cards.some((card) => card.id === CORNUCOPIA_CARD_ID)).toBe(
    false,
  );
  const victory = winBattle(played.state);
  expect(decodeSave(encodeSave(victory)).cards.some((card) => card.id === CORNUCOPIA_CARD_ID)).toBe(true);
});

it("Blinds an enemy only when a Light hit breaks its Block", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["suncrust-rolling-pin"];
  enemy.block = 4;
  hit(state, ally, enemy, 2, "light", events);
  expect(enemy.combat.blind).toBe(false);
  hit(state, ally, enemy, 2, "light", events);
  expect(enemy.combat.blind).toBe(true);
});

it("turns unspent Mana into team Block before enemies act", () => {
  const { state, events } = fixture();
  state.boons = ["dew-pendulum"];
  state.battle.mana = 3;
  finishTurn(state, events);
  expect(events.filter((event) => event.kind === "block" && event.amount === 3)).toHaveLength(3);
});
