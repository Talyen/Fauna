import { produce } from "immer";
import { expect, it } from "vitest";
import { ordinaryAttackFacts } from "../../../src/game/ability-facts";
import { chooseBattleCommand } from "../../../src/application/battle-policy";
import { executeAbility } from "../../../src/game/combat/abilities";
import { freshCombat } from "../../../src/game/combat/index";
import { definition } from "../../../src/game/content";
import { drawAtTurnStart } from "../../../src/game/card-zones";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { addReserve, requireBattle, teamRun } from "../../support/game";
import { setBattleCards } from "../../support/cards";

it("retains a defeated borrowed summon's status attribution when another kind fills its slot", () => {
  const state = produce(requireBattle(teamRun(42, ["wendlet", "coralcurl", "mossguard"])), (draft) => {
    addReserve(draft, "memento-backup", "memento", 30, freshCombat());
    addReserve(draft, "chronora-backup", "chronora", 30, freshCombat());
    const actor = draft.team[0]!;
    const echo = definition("memento-lost-procession");
    executeAbility(draft, { side: "player", actor, def: echo, value: echo.value }, []);
    const departed = draft.battle.minions![0]!;
    departed.health = 0;
    const enemy = draft.battle.enemies[0]!;
    enemy.combat.burn = 3;
    enemy.combat.statusSources.burn = departed.id;
    const bridge = definition("chronora-bridge-rewind");
    executeAbility(draft, { side: "player", actor, def: bridge, value: bridge.value }, []);
    expect(draft.battle.minions!.find((unit) => unit.id === departed.id)?.health).toBe(0);
    expect(draft.battle.minions!.some((unit) => unit.name === "Pendulum" && unit.health > 0)).toBe(true);
    executeAbility(draft, { side: "player", actor, def: bridge, value: bridge.value }, []);
    executeAbility(draft, { side: "player", actor, def: echo, value: echo.value }, []);
    expect(draft.battle.minions!.filter((unit) => unit.health > 0)).toHaveLength(2);
  });
  expect(decodeSave(encodeSave(state))).toEqual(state);
});

it("rejects roster identities in the Ward namespace before a summon can collide", () => {
  const valid = produce(requireBattle(teamRun(42, ["tithemaw"])), (draft) => {
    addReserve(draft, "backup", "mossguard", 32, freshCombat());
  });
  expect(decodeSave(encodeSave(valid))).toEqual(valid);
  const state = produce(valid, (draft) => {
    draft.reserves[0]!.id = "ward-ally-0-0";
  });
  expect(() => decodeSave(encodeSave(state))).toThrow();
});

it("includes living Pendulums in ordinary attack estimates", () => {
  const state = requireBattle(teamRun(42, ["chronora"]));
  const attack = definition("chronora-pendulum-break");
  if (attack.effect !== "attack") throw new Error("Expected an attack");
  const target = state.battle.enemies[0]!;
  const fact = ordinaryAttackFacts(state, state.team[0]!, attack, attack.value, target)[0]!;
  expect(fact.lost + fact.blocked).toBe(attack.value + 2);
});

it("lets Auto-play evaluate Gilded Ward and summon its defenders", () => {
  const state = produce(requireBattle(teamRun(42, ["tithemaw"])), (draft) => {
    const card = draft.cards.find((entry) => entry.definitionId === "tithemaw-gilded-ward")!;
    setBattleCards(draft, [card.id]);
  });
  expect(chooseBattleCommand(state, false)).toMatchObject({
    type: "play",
    cardId: state.battle.hand[0],
  });
});

it("does not draw a fallen creature's cards while waiting for a backup", () => {
  const state = produce(requireBattle(teamRun(42, ["mossguard"])), (draft) => {
    addReserve(draft, "backup", "wendlet", 24, freshCombat());
    draft.team[0]!.health = 0;
    const card = draft.cards[0]!;
    draft.battle.draw = [card.id];
    draft.battle.hand = [];
    draft.battle.buffer = [];
    draft.battle.discard = draft.cards.slice(1).map((entry) => entry.id);
    expect(drawAtTurnStart(draft, 1, [])).toBe(0);
    expect(draft.battle.draw).toEqual([card.id]);
    expect(draft.battle.hand).toEqual([]);
  });
  expect(decodeSave(encodeSave(state))).toEqual(state);
});
