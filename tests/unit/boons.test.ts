import { expect, it } from "vitest";
import { freshCombat, hit, removeEffects, restoreHealth, tickStatuses } from "../../src/game/combat";
import { decodeSave, encodeSave } from "../../src/game/save";
import { previewCard } from "../../src/game/engine";
import { BOONS } from "../../src/game/progression";
import { definition } from "../../src/game/content";
import { accept, run, winBattle } from "./helpers";
import type { GameEvent } from "../../src/game/types";
function fixture() {
  const state = structuredClone(run());
  const source = state.team[1]!,
    target = state.battle!.enemies[0]!;
  target.health = target.maxHealth = 100;
  target.block = 0;
  target.combat = freshCombat();
  // Suppress Dodge without extra randomness so packet magnitudes are comparable.
  target.combat.controlled = "freeze";
  state.rng = 42;
  return { state, source, target, events: [] as GameEvent[] };
}
it("doubles only the first allied direct Burn hit across swaps, previews and resume", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["meteorite"];
  // A periodic packet neither consumes nor receives Meteorite.
  hit(state, source, target, 2, "burn", events, { periodic: true });
  expect(state.battle!.meteoriteUsed).toBe(false);
  hit(state, source, target, 5, "burn", events);
  expect(events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([2, 10]);
  hit(state, source, target, 5, "burn", events);
  expect(events.filter((event) => event.kind === "damage").at(-1)!.amount).toBe(5);

  const saved = structuredClone(run());
  saved.boons = ["meteorite"];
  const burn = saved.cards.find((card) => {
    const def = definition(card.definitionId);
    return def.effects?.some((effect) => effect.kind === "damage" && effect.damageType === "burn");
  })!;
  saved.battle!.hand = [burn.id];
  saved.battle!.draw = saved.cards.filter((card) => card.id !== burn.id).map((card) => card.id);
  saved.battle!.buffer = [];
  saved.battle!.discard = [];
  saved.battle!.enemies[0]!.combat.controlled = "freeze";
  const preview = previewCard(saved, burn.id, "enemy-0");
  expect(preview.accepted && preview.state.battle!.meteoriteUsed).toBe(true);
  expect(saved.battle!.meteoriteUsed).toBe(false);
  const played = accept(saved, { type: "play", cardId: burn.id, targetId: "enemy-0", autoEndTurn: false });
  const resumed = decodeSave(encodeSave(played));
  expect(resumed.battle!.meteoriteUsed).toBe(true);
  const reserve = { ...resumed.team[0]!, id: "reserve-burn" };
  const swappable = {
    ...structuredClone(resumed),
    reserves: [reserve],
    roster: [...resumed.roster, reserve.species],
  };
  expect(
    accept(swappable, { type: "swap", activeId: swappable.team[1]!.id, reserve: reserve.id }).battle!
      .meteoriteUsed,
  ).toBe(true);
  const next = accept(winBattle(played), { type: "skipRecruit" });
  expect(next.phase).toBe("teamSelection");
  expect(accept(next, { type: "beginBattle" }).battle!.meteoriteUsed).toBe(false);
});
it("does not consume Meteorite on a Dodge or enemy hit", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["meteorite"];
  target.combat.controlled = null;
  target.combat.dodge = 70;
  hit(state, source, target, 5, "burn", events);
  expect(state.battle!.meteoriteUsed).toBe(false);
  hit(state, target, source, 5, "burn", events);
  expect(state.battle!.meteoriteUsed).toBe(false);
});
it("heals only actually Cleansed allied effects and combines with Renewal", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["sin-eaters-lantern", "groves-favor"];
  state.talents = ["heal.renewal"];
  source.health = 1;
  source.combat = freshCombat();
  source.combat.burn = 3;
  source.combat.poison = 4;
  removeEffects(source, "cleanse", 2, events, state);
  expect(source.health).toBe(17);
  expect(source.combat.thorns).toBe(1);
  removeEffects(source, "cleanse", 2, events, state);
  expect(source.health).toBe(17);
  target.health = 10;
  target.combat.poison = 1;
  removeEffects(target, "cleanse", 1, events, state);
  expect(target.health).toBe(10);
  source.combat.armor = 2;
  removeEffects(source, "purge", 1, events, state);
  expect(source.health).toBe(17);
});
it("triggers Thunderstone once per successful Stun, without retaliation or status recursion", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["thunderstone"];
  target.combat.controlled = null;
  hit(state, source, target, 50, "stun", events);
  expect(target.health).toBe(44);
  expect(target.combat.controlled).toBe("stun");
  hit(state, source, target, 1, "stun", events);
  tickStatuses(state, target, events);
  expect(events.filter((event) => event.kind === "damage" && event.damageType === "nature")).toHaveLength(1);
});
it("grants Thorns only for actual allied healing in battle, never full Health or Campfire healing", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["groves-favor"];
  restoreHealth(source, 1, events, false, state);
  expect(source.combat?.thorns ?? 0).toBe(0);
  source.health -= 2;
  restoreHealth(source, 1, events, false, state);
  expect(source.combat!.thorns).toBe(1);
  target.health -= 2;
  restoreHealth(target, 1, events, false, state);
  expect(target.combat.thorns).toBe(0);
  state.phase = "campfire";
  restoreHealth(source, 1, events, false, state);
  expect(source.combat!.thorns).toBe(1);
  expect(() => decodeSave(JSON.stringify({ ...run(), version: 15 }))).toThrow();
  const current = { ...structuredClone(run()), boons: BOONS.map((boon) => boon.id) };
  expect(decodeSave(encodeSave(current)).boons).toEqual(current.boons);
});
