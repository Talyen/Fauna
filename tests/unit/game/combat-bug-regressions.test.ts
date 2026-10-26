import {
  addReserve,
  accept,
  authoredPack,
  prepareDestination,
  requireBattle,
  run,
  teamRun,
} from "../../support/game";
import { setBattleCards } from "../../support/cards";
import { expect, it } from "vitest";
import { freshCombat, hit, gainMana, tickStatuses } from "../../../src/game/combat/index";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { summonEcho } from "../../../src/game/combat/legendary";
import { species } from "../../../src/game/content";
import type { BattleState, GameEvent } from "../../../src/game/types";
import { dispatch, previewCard } from "../../../src/game/engine";
import { pendingReplacement, swapBackup } from "../../../src/game/team";
import { produce } from "immer";

it("retains a departed Echo's status attribution and periodic Gold rewards after resume", () => {
  const state = structuredClone(requireBattle(teamRun(42, ["memento"])));
  const owner = state.team[0]!;
  summonEcho(state, owner, "player", 6, []);
  const echo = state.battle.minions![0]!;
  const target = state.battle.enemies[0]!;
  target.block = 0;
  target.combat = freshCombat();
  state.boons = ["cutpurse-knife", "knot-comb", "orbit-armillary"];
  hit(state, target, echo, 2, "bleed", [], { origin: "proc" });
  // Knot Comb returns the Echo's wound through Orbit Armillary before it departs.
  tickStatuses(state, echo, []);
  expect(target.combat.statusSources.bleed).toBe(echo.id);
  addReserve(state, "backup", "mossguard", species("mossguard").health, freshCombat());
  swapBackup(state, owner.id, "backup", []);
  const resumed = decodeSave(encodeSave(state));
  const events: GameEvent[] = [];

  const result = produce(resumed, (draft) => {
    tickStatuses(draft, draft.battle!.enemies[0]!, events);
  });

  expect(events.find((event) => event.kind === "damage" && event.periodic)).toMatchObject({
    actorId: echo.id,
    targetId: target.id,
    damageType: "bleed",
  });
  expect(result.currency).toBe(resumed.currency + 1);
  expect(decodeSave(encodeSave(result))).toEqual(result);
});

it("retains Last Light Charge's guaranteed critical hit when reflected", () => {
  const state = produce(requireBattle(teamRun(42, ["alpenglen"])), (draft) => {
    const card = draft.cards.find((entry) => entry.definitionId === "alpenglen-last-light-charge")!;
    setBattleCards(draft, [card.id]);
    draft.team[0]!.combat = freshCombat();
    draft.battle.enemies[0]!.combat = { ...freshCombat(), attackReflection: true };
    draft.rng = 42;
  });
  const cardId = state.battle.hand[0]!;
  const targetId = state.battle.enemies[0]!.id;

  const result = dispatch(state, { type: "play", cardId, targetId, autoEndTurn: false });

  expect(result.accepted).toBe(true);
  expect(result.events.find((event) => event.kind === "damage")).toMatchObject({
    actorId: targetId,
    targetId: state.team[0]!.id,
    damageType: "light",
    amount: 8,
    critical: true,
  });
  expect(previewCard(state, cardId, targetId)).toEqual(result);
});

function bossBattle() {
  const destination = produce(teamRun(42, ["pollenmoth"]), (state) => {
    prepareDestination(state);
    state.encounter = 3;
    state.journey!.victories = 3;
    state.expedition = { pack: authoredPack(3), recruit: null, lastRoom: "boss" };
  });
  return structuredClone(requireBattle(accept(destination, { type: "beginBattle" })));
}

it("Pollenmoth's Light bounces reach living enemy Echoes", () => {
  const state = bossBattle();
  const source = state.team[0]!;
  const boss = state.battle.enemies[0]!;
  boss.block = 0;
  boss.combat = { ...freshCombat(), controlled: "stun", controlTurns: 1 };
  summonEcho(state, boss, "enemy", 6, []);
  const echo = state.battle.minions![0]!;
  echo.combat.controlled = "stun";
  echo.combat.controlTurns = 1;
  const events: GameEvent[] = [];
  hit(state, source, boss, 3, "light", events);
  expect(echo.health).toBeLessThan(6);
  expect(events.some((event) => event.kind === "damage" && event.targetId === echo.id)).toBe(true);
});

it("Arcane Mending heals deployed Echoes along with their summoner", () => {
  const state = structuredClone(teamRun(42, ["memento"])) as BattleState;
  const actor = state.team[0]!;
  state.talents = ["mana.arcane-mending"];
  summonEcho(state, actor, "player", 6, []);
  const echo = state.battle.minions![0]!;
  echo.health = 2;
  actor.health -= 4;
  state.battle.mana = 0;
  gainMana(state, 2, []);
  expect(actor.health).toBe(species(actor.species).health - 2);
  expect(echo.health).toBe(4);
});

it("returns a knockout replacement after one round even when its backup skipped that turn", () => {
  const state = structuredClone(run());
  for (const ally of state.team) {
    ally.health = 1;
    ally.block = 0;
    ally.combat = { ...freshCombat(), deathDoorUsed: true, poison: 2 };
  }
  state.reserves.push({
    id: "backup",
    species: "pollenmoth",
    health: species("pollenmoth").health,
    block: 0,
    attacked: false,
    combat: { ...freshCombat(), controlled: "freeze", controlTurns: 1, poison: 2 },
  });
  for (const enemy of state.battle!.enemies) {
    enemy.combat.controlled = "stun";
    enemy.combat.controlTurns = 1;
  }
  const result = dispatch(state, { type: "endTurn" });
  expect(result.accepted).toBe(true);
  expect(result.state.phase).toBe("battle");
  expect(pendingReplacement(result.state)).toBeDefined();
  expect(result.state.battle!.turn).toBe(state.battle!.turn + 1);
  expect(result.state.reserves[0]!.combat!.skipped).toBe(true);
  expect(result.state.reserves[0]!.health).toBe(species("pollenmoth").health - 2);
});

it("resumes a return home from the final boss recruitment without losing the completed journey", () => {
  const destination = produce(run(), (state) => {
    prepareDestination(state);
    state.encounter = 7;
    state.journey!.victories = 7;
    state.expedition = { pack: authoredPack(7), recruit: null, lastRoom: "boss" };
  });
  const battle = accept(destination, { type: "beginBattle" });
  const won = dispatch(battle, { type: "devWinBattle" }, true).state;
  expect(won.phase).toBe("recruit");
  expect(decodeSave(encodeSave(won))).toEqual(won);

  const returned = accept(won, { type: "abandon" });

  expect(returned.journey).toMatchObject({ outcome: "returned", victories: 8 });
  expect(returned.wins).toBe(won.wins);
  expect(returned.currency).toBe(won.currency);
  expect(decodeSave(encodeSave(returned))).toEqual(returned);
  const unearned = produce(returned, (game) => {
    game.wins = 0;
  });
  expect(() => decodeSave(encodeSave(unearned))).toThrow();
});

it.each(["block", "armor"] as const)(
  "Rupture detonates an existing wound on a critical hit absorbed by %s",
  (defense) => {
    const state = structuredClone(run());
    state.talents = ["physical.rupture"];
    const source = state.team[0]!;
    const target = state.battle!.enemies[0]!;
    source.combat = { ...freshCombat(), riposte: true };
    target.species = "mossguard";
    target.health = target.maxHealth = 100;
    target.block = defense === "block" ? 100 : 0;
    target.combat = {
      ...freshCombat(),
      armor: defense === "armor" ? 100 : 0,
      bleed: 6,
      controlled: "stun",
      controlTurns: 1,
    };
    target.combat.statusSources.bleed = source.id;
    const events: GameEvent[] = [];

    hit(state, source, target, 2, "physical", events);

    expect(events.find((event) => event.kind === "damage" && event.damageType === "physical")).toMatchObject({
      amount: 0,
      critical: true,
    });
    expect(events.find((event) => event.kind === "damage" && event.damageType === "bleed")).toMatchObject({
      amount: defense === "block" ? 0 : 6,
      periodic: true,
    });
    expect(target.health).toBe(defense === "block" ? 100 : 94);
    if (defense === "block") expect(target.block).toBeLessThan(94);
    expect(target.combat.bleed).toBe(0);
    expect(target.combat.statusSources.bleed).toBeUndefined();
    expect(target.combat.bleedLeech).toEqual([]);
  },
);

it("a blinded Echo misses its intended recipient before Gallantry can intercept it", () => {
  const destination = produce(teamRun(42, ["mossguard", "tournelle"]), (game) => {
    prepareDestination(game);
    game.encounter = 3;
    game.journey!.victories = 3;
    game.expedition = { pack: authoredPack(3), recruit: null, lastRoom: "boss" };
  });
  const state = structuredClone(requireBattle(accept(destination, { type: "beginBattle" })));
  state.discovery.recruited.tournelle = 6;
  const target = state.team[0]!;
  const protector = state.team[1]!;
  summonEcho(state, state.battle.enemies[0]!, "enemy", 6, []);
  const source = state.battle.minions![0]!;
  target.health = 1;
  protector.health = species(protector.species).health;
  source.combat = { ...freshCombat(), blind: true };
  state.rng = 42;
  const events: GameEvent[] = [];
  expect(decodeSave(encodeSave(state))).toEqual(state);

  hit(state, source, target, 3, "water", events);

  expect(events.some((event) => event.text.includes("intercepts"))).toBe(false);
  expect(events.find((event) => event.kind === "status" && event.outcome === "dodge")?.targetId).toBe(
    target.id,
  );
  expect(source.combat.blind).toBe(false);
  expect(target.health).toBe(1);
  expect(protector.health).toBe(species(protector.species).health);
});
