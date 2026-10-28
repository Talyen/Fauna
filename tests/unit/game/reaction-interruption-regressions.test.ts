import { produce } from "immer";
import { expect, it } from "vitest";
import { grantBlock, freshCombat } from "../../../src/game/combat/index";
import { unhurried } from "../../../src/game/combat/turns";
import { encodeSave, decodeSave } from "../../../src/game/save";
import type { GameEvent } from "../../../src/game/types";
import { accept, enemyPlay, prepareDestination, requireBattle, teamRun } from "../../support/game";

it.each([
  ["pollenmoth", "pollenmoth-teamGuard"],
  ["ringpalm", "ringpalm-teamProtection"],
  ["euphera", "euphera-wish-exchange"],
] as const)("%s stops its group Block after Apple Press knocks it out", (kind, ability) => {
  const destination = produce(teamRun(42, ["prismram"]), (draft) => {
    prepareDestination(draft);
    draft.expedition = { pack: [kind, "emberback", "mossguard"], recruit: null, lastRoom: null };
  });
  const state = produce(requireBattle(accept(destination, { type: "beginBattle" })), (draft) => {
    draft.boons = ["apple-press", "harvest-sickle"];
    const actor = draft.battle.enemies[0]!;
    actor.health = 1;
    actor.block = 0;
    actor.combat.bleed = 3;
    actor.combat.statusSources.bleed = draft.team[0]!.id;
    for (const enemy of draft.battle.enemies.slice(1)) enemy.block = 0;
  });
  expect(decodeSave(encodeSave(state))).toEqual(state);
  const result = enemyPlay(state, ability, { decisions: () => 0.1 });
  expect(result.state.battle!.enemies[0]!.health).toBe(0);
  expect(result.state.battle!.enemies.slice(1).map((enemy) => enemy.block)).toEqual([0, 0]);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  const survives = produce(state, (draft) => {
    draft.battle.enemies[0]!.health = 10;
  });
  const full = enemyPlay(survives, ability, { decisions: () => 0.1 });
  expect(full.state.battle!.enemies[0]!.health).toBeGreaterThan(0);
  expect(full.state.battle!.enemies.slice(1).every((enemy) => enemy.block > 0)).toBe(true);
});

function interruptedHealing(kinds: ("mossguard" | "bloomquail" | "reverie" | "prismram")[]) {
  const state = requireBattle(structuredClone(teamRun(42, kinds)));
  state.boons = ["yarrow-salve-tin", "orbit-armillary", "story-puzzle-cube"];
  state.battle.puzzleProgress = ["burn", "poison"];
  const enemy = state.battle.enemies[0]!;
  enemy.combat = { ...freshCombat(), armor: 1 };
  const recipient = state.team[0]!;
  recipient.health = 1;
  recipient.combat = { ...freshCombat(), bleed: 1, deathDoorUsed: true };
  recipient.combat.statusSources.bleed = enemy.id;
  const source = state.team[1]!;
  source.health = 1;
  source.combat = { ...freshCombat(), deathDoorUsed: true };
  return state;
}

it("does not grant Block after its Bloomquail provider falls during conversion", () => {
  const state = interruptedHealing(["mossguard", "bloomquail"]);
  const provider = state.team[1]!;
  grantBlock(state, provider, 2, []);
  expect(provider.health).toBe(0);
  expect(provider.block).toBe(0);
  const survives = interruptedHealing(["mossguard", "bloomquail"]);
  survives.boons = ["yarrow-salve-tin"];
  grantBlock(survives, survives.team[1]!, 2, []);
  expect(survives.team[1]!.health).toBeGreaterThan(0);
  expect(survives.team[1]!.block).toBe(1);
});

it("stops Unhurried healing when its provider falls during an earlier recipient's healing", () => {
  const state = interruptedHealing(["mossguard", "reverie", "prismram"]);
  const provider = state.team[1]!;
  const later = state.team[2]!;
  later.health -= 5;
  const events: GameEvent[] = [];
  unhurried(state, false, events);
  expect(provider.health).toBe(0);
  expect(events.some((event) => event.kind === "heal" && event.targetId === later.id)).toBe(false);
  const survives = interruptedHealing(["mossguard", "reverie", "prismram"]);
  survives.boons = ["yarrow-salve-tin"];
  survives.team[2]!.health -= 5;
  const completeEvents: GameEvent[] = [];
  unhurried(survives, false, completeEvents);
  expect(
    completeEvents.some((event) => event.kind === "heal" && event.targetId === survives.team[2]!.id),
  ).toBe(true);
});
