import { produce } from "immer";
import { expect, it } from "vitest";
import { chooseBattleCommand, rankedBattleChoices } from "../../../src/application/battle-policy";
import { actionValue } from "../../../src/game/ability-rules";
import { ordinaryAttackFacts } from "../../../src/game/ability-facts";
import { definition, species } from "../../../src/game/content";
import { freshCombat } from "../../../src/game/combat/index";
import { summonEcho } from "../../../src/game/combat/legendary";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import type { BattleState } from "../../../src/game/types";
import { addBackups, requireBattle, teamRun } from "../../support/game";

function handOnly(state: BattleState, definitionId: string) {
  return produce(state, (draft) => {
    const card = draft.cards.find((entry) => entry.definitionId === definitionId)!;
    draft.battle.hand = [card.id];
    draft.battle.buffer = [];
    draft.battle.discard = [];
    draft.battle.draw = draft.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
  });
}
function resumable(state: BattleState) {
  expect(decodeSave(encodeSave(state))).toEqual(state);
  return state;
}

it("Lost Procession summons into an open space without healing the existing Echo", () => {
  const before = resumable(
    produce(handOnly(requireBattle(teamRun(42, ["memento"])), "memento-lost-procession"), (draft) => {
      summonEcho(draft, draft.team[0]!, "player", 6, []);
      draft.battle.minions![0]!.health = 1;
    }),
  );
  const result = dispatch(before, { type: "play", cardId: before.battle.hand[0]!, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.battle!.minions!.map((unit) => unit.health)).toEqual([1, 6]);
  expect(result.events.filter((event) => event.text === "The Court Remembers")).toHaveLength(1);
  expect(previewCard(before, before.battle.hand[0]!)).toEqual(result);
  resumable(requireBattle(result.state));

  const full = handOnly(requireBattle(result.state), "memento-lost-procession");
  const healed = dispatch(full, { type: "play", cardId: full.battle.hand[0]!, autoEndTurn: false });
  expect(healed.state.battle!.minions!.map((unit) => unit.health)).toEqual([6, 6]);
});

it("Auto-play estimates Crater Punch's guaranteed Light critical using the actual damage rule", () => {
  const before = resumable(
    produce(handOnly(requireBattle(teamRun(42, ["alpenglen"])), "alpenglen-last-light-charge"), (draft) => {
      draft.boons = ["crater-punch"];
      const target = draft.battle.enemies[0]!;
      target.health = 2;
      target.block = 100;
      target.combat = { ...freshCombat(), controlled: "stun", controlTurns: 1 };
    }),
  );
  const card = before.cards.find((entry) => entry.id === before.battle.hand[0])!;
  const def = definition(card.definitionId);
  if (def.effect !== "attack") throw new Error("Expected an attack");
  const target = before.battle.enemies[0]!;
  const [fact] = ordinaryAttackFacts(
    before,
    before.team[0]!,
    def,
    actionValue(card, before.team[0]!, before),
    target,
  );
  const result = dispatch(before, { type: "play", cardId: card.id, targetId: target.id, autoEndTurn: false });
  expect(fact!.lost).toBeGreaterThan(0);
  expect(fact!.lethal).toBe(true);
  expect(result.state.battle!.enemies[0]!.health).toBe(0);
  expect(
    result.events.find((event) => event.kind === "damage" && event.targetId === target.id),
  ).toMatchObject({ amount: Math.min(target.health, fact!.lost) });
  resumable(requireBattle(result.state));
});

it("Auto-play keeps Safe Passage when no backup or other drawable card is available", () => {
  const before = resumable(
    produce(requireBattle(teamRun(42, ["tournelle"])), (draft) => {
      draft.battle.hand = draft.cards.map((card) => card.id);
      draft.battle.buffer = [];
      draft.battle.discard = [];
      draft.battle.draw = [];
    }),
  );
  const card = before.cards.find((entry) => entry.definitionId === "tournelle-swapLowest")!;
  const choice = (state: BattleState) =>
    rankedBattleChoices(state, false).find(
      (entry) => entry.command.type === "play" && entry.command.cardId === card.id,
    );
  expect(choice(before)).toBeUndefined();
  const drawable = produce(before, (draft) => {
    const other = draft.battle.hand.find((id) => id !== card.id)!;
    draft.battle.hand = draft.battle.hand.filter((id) => id !== other);
    draft.battle.draw = [other];
  });
  const selected = choice(drawable)!;
  expect(selected).toBeDefined();
  const result = dispatch(drawable, selected.command);
  expect(result.state.battle!.hand).toContain(drawable.battle.draw[0]);
  resumable(requireBattle(result.state));
  for (const boon of ["mineral-bookend", "dune-shuttle"] as const) {
    const rewarded = produce(before, (draft) => {
      draft.boons = [boon];
    });
    const selected = choice(rewarded)!;
    expect(selected).toBeDefined();
    const result = dispatch(rewarded, selected.command);
    expect(
      result.state.battle!.mana > before.battle.mana - 1 ||
        result.state.team[0]!.block > before.team[0]!.block,
    ).toBe(true);
  }
  const withBackup = produce(before, (draft) => {
    addBackups(draft, {
      id: "backup",
      species: "mossguard",
      health: species("mossguard").health,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    });
  });
  const swapped = dispatch(withBackup, choice(withBackup)!.command);
  expect(swapped.state.team[0]!.id).toBe("backup");
  resumable(requireBattle(swapped.state));
});

it("Auto-play keeps Coral Spiral when there is no swap or Blind left to perform", () => {
  const before = resumable(
    produce(handOnly(requireBattle(teamRun(42, ["coralcurl"])), "coralcurl-swap"), (draft) => {
      for (const target of draft.battle.enemies) target.combat.blind = true;
    }),
  );
  expect(chooseBattleCommand(before, false)).toEqual({ type: "endTurn" });
  const useful = produce(before, (draft) => {
    draft.battle.enemies[0]!.combat.blind = false;
  });
  const command = chooseBattleCommand(useful, false);
  expect(command).toMatchObject({ type: "play", cardId: useful.battle.hand[0] });
  expect(dispatch(useful, command).state.battle!.enemies[0]!.combat.blind).toBe(true);
  const withBackup = produce(before, (draft) => {
    addBackups(draft, {
      id: "backup",
      species: "mossguard",
      health: species("mossguard").health,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    });
  });
  const swapped = dispatch(withBackup, chooseBattleCommand(withBackup, false));
  expect(swapped.state.team[0]!.id).toBe("backup");
  resumable(requireBattle(swapped.state));
});

it("Auto-play keeps Lost Procession when full healthy Echoes cannot answer the card", () => {
  const before = resumable(
    produce(handOnly(requireBattle(teamRun(42, ["memento"])), "memento-lost-procession"), (draft) => {
      summonEcho(draft, draft.team[0]!, "player", 6, []);
      summonEcho(draft, draft.team[0]!, "player", 6, []);
      for (const echo of draft.battle.minions!) {
        echo.combat.controlled = "freeze";
        echo.combat.controlTurns = 1;
      }
    }),
  );
  expect(chooseBattleCommand(before, false)).toEqual({ type: "endTurn" });
  for (const benefit of ["heal", "attack"] as const) {
    const useful = produce(before, (draft) => {
      const echo = draft.battle.minions![0]!;
      if (benefit === "heal") echo.health = 1;
      else {
        echo.combat.controlled = null;
        echo.combat.controlTurns = 0;
      }
    });
    expect(rankedBattleChoices(useful, false)[0]?.command).toMatchObject({
      type: "play",
      cardId: useful.battle.hand[0],
    });
  }
});
