import { expect, it } from "vitest";
import {
  freshCombat,
  hit,
  removeEffects,
  restoreHealth,
  startAction,
  tickStatuses,
} from "../../../src/game/combat/index";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { previewCard } from "../../../src/game/engine";
import { BOONS } from "../../../src/game/progression";
import { definition } from "../../../src/game/content";
import { encounterSource } from "../../../src/game/encounters";
import { recruitChoice, accept, run, winBattle } from "../../support/game";
import type { GameEvent } from "../../../src/game/types";
function fixture() {
  const state = structuredClone(run());
  const source = state.team[1]!,
    target = state.battle!.enemies[0]!;
  target.health = target.maxHealth = 100;
  target.block = 0;
  target.combat = freshCombat();
  // Suppress Dodge without extra randomness so packet magnitudes are comparable.
  target.combat.controlled = "freeze";
  target.combat.controlTurns = 1;
  state.rng = 42;
  return { state, source, target, events: [] as GameEvent[] };
}
it("preserves Meteorite through triggered Burn for the next direct Burn hit", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["meteorite"];
  hit(state, source, target, 3, "burn", events, { origin: "proc" });
  expect(state.battle!.meteoriteUsed).toBe(false);
  hit(state, source, target, 5, "burn", events);
  expect(state.battle!.meteoriteUsed).toBe(true);
  expect(events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([3, 10]);
});
it("doubles only the first allied direct Burn hit across swaps, previews and resume", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["meteorite"];
  // A periodic packet neither consumes nor receives Meteorite.
  hit(state, source, target, 2, "burn", events, { origin: "periodic" as const });
  expect(state.battle!.meteoriteUsed).toBe(false);
  hit(state, source, target, 5, "burn", events);
  expect(events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([2, 10]);
  hit(state, source, target, 5, "burn", events);
  expect(events.filter((event) => event.kind === "damage").at(-1)!.amount).toBe(5);

  const saved = structuredClone(run());
  saved.boons = ["meteorite"];
  const burn = saved.cards.find((card) => {
    const def = definition(card.definitionId);
    return def.effect === "attack" && def.damageType === "burn";
  })!;
  saved.battle!.hand = [burn.id];
  saved.battle!.draw = saved.cards.filter((card) => card.id !== burn.id).map((card) => card.id);
  saved.battle!.buffer = [];
  saved.battle!.discard = [];
  saved.battle!.enemies[0]!.combat.controlled = "freeze";
  saved.battle!.enemies[0]!.combat.controlTurns = 1;
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
  const won = winBattle(played);
  const next = accept(won, recruitChoice(won));
  expect(next.phase).toBe("teamSelection");
  expect(accept(next, { type: "beginBattle" }).battle!.meteoriteUsed).toBe(false);
});
it("does not consume Meteorite on a Dodge or enemy hit", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["meteorite"];
  target.combat.controlled = null;
  target.combat.controlTurns = 0;
  target.combat.dodge = 70;
  hit(state, source, target, 5, "burn", events);
  expect(state.battle!.meteoriteUsed).toBe(false);
  hit(state, target, source, 5, "burn", events);
  expect(state.battle!.meteoriteUsed).toBe(false);
});
it("heals only actually Cleansed allied effects and combines with Renewal", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["sin-eaters-lantern", "groves-favor"];
  state.talents = ["health.renewal"];
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
  target.combat.controlTurns = 0;
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
it("strips Armor before Physical and Stun mitigation, including fully blocked hits", () => {
  for (const type of ["physical", "stun"] as const) {
    const { state, source, target, events } = fixture();
    state.boons = ["sundering-charm"];
    target.combat.armor = 5;
    hit(state, source, target, 8, type, events, { origin: "proc" as const });
    expect(target.health).toBe(95);
    expect(target.combat.armor).toBe(2);
    target.block = 20;
    hit(state, source, target, 8, type, events, { origin: "proc" as const });
    expect(target.combat.armor).toBe(0);
    expect(target.health).toBe(95);
  }
});
it("extends enemy Freeze across resume and grants immunity only after both skipped turns", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["frozen-pocketwatch"];
  target.maxHealth = encounterSource(state).enemies[0]!.health;
  target.health = 18;
  target.combat.controlled = null;
  target.combat.controlTurns = 0;
  hit(state, source, target, 15, "freeze", events, { origin: "proc" as const });
  expect(target.combat.controlTurns).toBe(2);
  const resumed = structuredClone(decodeSave(encodeSave(state)));
  const enemy = resumed.battle!.enemies[0]!;
  startAction(enemy, events, resumed);
  expect(enemy.combat.controlled).toBe("freeze");
  expect(enemy.combat.cooldown).toBe(0);
  startAction(enemy, events, resumed);
  expect(enemy.combat.controlled).toBeNull();
  expect(enemy.combat.cooldown).toBe(3);
});
it("banks Cutpurse Gold for hits and ticks exactly once and caps actual retained earnings", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["cutpurse-knife"];
  target.maxHealth = encounterSource(state).enemies[0]!.health;
  target.health = 18;
  const before = state.currency;
  hit(state, source, target, 5, "bleed", events, { origin: "proc" as const });
  tickStatuses(state, target, events);
  expect(state.currency - before).toBe(2);
  expect(state.battle!.earnedGold).toBe(2);
  expect(decodeSave(encodeSave(state)).battle!.earnedGold).toBe(2);
  tickStatuses(state, target, events);
  expect(state.currency - before).toBe(2);
  state.currency = 1_000_000;
  hit(state, source, target, 5, "bleed", events, { origin: "proc" as const });
  expect(state.battle!.earnedGold).toBe(2);
});
it("cleanses Poison before ticks, healing only a fully removed effect and attacking the first living enemy", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["plague-doctors-mask", "sin-eaters-lantern"];
  source.health = 5;
  source.combat!.poison = 4;
  tickStatuses(state, source, events);
  expect(source.health).toBe(3);
  expect(source.combat!.poison).toBe(1);
  expect(target.combat.poison).toBe(1);
  tickStatuses(state, source, events);
  expect(source.health).toBe(9);
  expect(source.combat!.poison).toBe(0);
  expect(target.combat.poison).toBe(2);
  tickStatuses(state, source, events);
  expect(source.health).toBe(9);
});
it("uses seeded chances for Brass Censer, Parasitic Bloom and Lucky Clover without enemy triggers", () => {
  const seen = new Set<string>();
  for (let seed = 0; seed < 300; seed++) {
    for (const boon of ["brass-censer", "parasitic-bloom", "lucky-clover"] as const) {
      const { state, source, target, events } = fixture();
      state.boons = [boon];
      source.health = 1;
      state.rng = seed * 100_003;
      const type = boon === "brass-censer" ? "light" : boon === "parasitic-bloom" ? "poison" : "nature";
      hit(state, source, target, 8, type, events, { origin: "proc" as const });
      if (target.combat.burn) seen.add("burn");
      if (source.health > 1) seen.add(boon);
      if (state.currency > 0) {
        seen.add(boon);
        expect(state.currency).toBe(8);
        expect(state.battle!.earnedGold).toBe(8);
      }
      const repeat = fixture();
      repeat.state.boons = [boon];
      repeat.source.health = 1;
      repeat.state.rng = seed * 100_003;
      hit(repeat.state, repeat.source, repeat.target, 8, type, repeat.events, { origin: "proc" as const });
      expect(repeat.events).toEqual(events);
      expect(repeat.state.rng).toBe(state.rng);
      const before = state.currency;
      hit(state, target, source, 1, type, events, { origin: "proc" as const });
      expect(state.currency).toBe(before);
    }
  }
  expect(seen).toEqual(new Set(["burn", "brass-censer", "parasitic-bloom", "lucky-clover"]));
});
it("counts accepted cards once across previews and resume, refunds before auto-end and resets next turn", () => {
  const state = structuredClone(run());
  state.boons = ["resonant-chimes"];
  state.battle!.cardsPlayedThisTurn = 2;
  const card = state.cards.find((c) => definition(c.definitionId).effect === "guard")!;
  state.battle!.hand = [card.id];
  state.battle!.draw = state.cards.filter((c) => c.id !== card.id).map((c) => c.id);
  state.battle!.buffer = [];
  state.battle!.discard = [];
  state.battle!.mana = definition(card.definitionId).cost;
  const targetId = card.ownerId;
  const preview = previewCard(state, card.id, targetId);
  expect(preview.accepted && preview.state.battle!.mana).toBe(1);
  expect(state.battle!.cardsPlayedThisTurn).toBe(2);
  const played = accept(decodeSave(encodeSave(state)), { type: "play", cardId: card.id, targetId });
  expect(played.battle!.turn).toBe(1);
  expect(played.battle!.mana).toBe(1);
  expect(decodeSave(encodeSave(played)).battle!.cardsPlayedThisTurn).toBe(3);
  const fourth = structuredClone(played);
  fourth.battle!.hand = [card.id];
  fourth.battle!.draw = fourth.cards.filter((c) => c.id !== card.id).map((c) => c.id);
  fourth.battle!.buffer = [];
  fourth.battle!.discard = [];
  fourth.battle!.mana = definition(card.definitionId).cost;
  const fourthPlayed = accept(fourth, { type: "play", cardId: card.id, targetId, autoEndTurn: false });
  expect(fourthPlayed.battle!.mana).toBe(0);
  expect(fourthPlayed.battle!.cardsPlayedThisTurn).toBe(3);
  expect(accept(played, { type: "endTurn" }).battle!.cardsPlayedThisTurn).toBe(0);
  expect(() => decodeSave(JSON.stringify({ ...played, version: 19 }))).toThrow();
});
it("does not pay Gold or roll offensive Boons on blocked damage or enemy packets", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["cutpurse-knife", "parasitic-bloom", "lucky-clover", "brass-censer"];
  source.health = 10;
  for (const type of ["bleed", "poison", "nature", "light"] as const) {
    const before = state.rng;
    target.block = 100;
    hit(state, source, target, 5, type, events, { origin: "proc" as const });
    expect(state.rng).toBe(before);
    expect(state.currency).toBe(0);
    expect(source.health).toBe(10);
    source.block = 100;
    hit(state, target, source, 5, type, events, { origin: "proc" as const });
    expect(state.rng).toBe(before);
    expect(state.currency).toBe(0);
    expect(target.health).toBe(100);
  }
});
it("lets attributed Poison ticks Leech from reserve sources without healing enemy sources", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["parasitic-bloom"];
  state.team = state.team.filter((unit) => unit.id !== source.id);
  state.reserves = [source];
  source.health = 1;
  target.combat.poison = 8;
  target.combat.statusSources.poison = source.id;
  state.rng = 2000;
  tickStatuses(state, target, events);
  expect(source.health).toBe(5);
  source.combat!.poison = 8;
  source.combat!.statusSources.poison = target.id;
  target.health = 50;
  state.rng = 2000;
  tickStatuses(state, source, events);
  expect(target.health).toBe(50);
});
it("settles a Mask victory before remaining allied damage can knock out its wearer", () => {
  const state = structuredClone(run());
  state.boons = ["plague-doctors-mask"];
  state.team.forEach((unit, i) => {
    unit.health = i === 0 ? 1 : 0;
    unit.combat = freshCombat();
    unit.combat.deathDoorUsed = true;
    if (i === 0) {
      unit.combat.poison = 2;
      unit.combat.burn = 100;
    }
  });
  state.battle!.enemies.forEach((enemy, i) => {
    enemy.health = i === 0 ? 1 : 0;
    enemy.block = 0;
    enemy.combat = freshCombat();
    enemy.combat.controlled = "freeze";
    enemy.combat.controlTurns = 1;
  });
  const next = accept(state, { type: "endTurn" });
  expect(next.phase).toBe("recruit");
  expect(next.team[0]!.health).toBe(1);
});
