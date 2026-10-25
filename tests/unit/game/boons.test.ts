import {
  swapFixture,
  completeRecruitment,
  accept,
  run,
  winBattle,
  requireBattle,
  addBackups,
  teamRun,
} from "../../support/game";
import { expect, it } from "vitest";
import {
  freshCombat,
  hit,
  removeEffects,
  restoreHealth,
  startAction,
  tickStatuses,
  gainMana,
  applyBlind,
  beginAttack,
} from "../../../src/game/combat/index";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { dispatch, previewCard } from "../../../src/game/engine";
import { BOONS, definition } from "../../../src/game/content";
import { encounterSource } from "../../../src/game/encounters";
import type { GameEvent } from "../../../src/game/types";
import { executeAbility } from "../../../src/game/combat/abilities";
import { playTargetError } from "../../../src/game/play-queries";
import { species } from "../../../src/game/content";
import { NEW_BOON_EFFECTS } from "../../support/boons";
import { ordinaryAttackFacts } from "../../../src/game/ability-facts";
import { afterPlayerCard } from "../../../src/game/combat/card-modifiers";
import prepared from "../../../src/assets/prepared.json";
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

it.each(Object.entries(NEW_BOON_EFFECTS))(
  "registers the approved %s effect and prepared portrait",
  (id, text) => {
    expect(BOONS.find((boon) => boon.id === id)?.text).toBe(text);
    expect(Object.hasOwn(prepared.records, `boon.${id}`)).toBe(true);
  },
);

it("Briar Racquet spends one Nature Thorns stack for a half-strength Dodge retaliation without a chain", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["briar-racquet"];
  source.combat = { ...freshCombat(), thorns: 6, waterThorns: 5 };
  target.combat.thorns = 20;
  const rng = state.rng;
  hit(state, target, source, 10, "physical", events, { origin: "ability", blindMiss: true });
  expect(source.health).toBe(species(source.species).health);
  expect(target.health).toBe(97);
  expect(source.combat.thorns).toBe(5);
  expect(source.combat.waterThorns).toBe(5);
  expect(target.combat.thorns).toBe(20);
  expect(state.rng).toBe(rng);
});

it("Lovers Knot returns actual ally Healing without reapplying modifiers or returning self-Healing", () => {
  const { state, source, events } = fixture();
  state.boons = ["lovers-knot", "groves-favor", "thaw-spoon"];
  state.talents = ["health.mending"];
  const ally = state.team[0]!;
  ally.health = species(ally.species).health - 3;
  source.health = 1;
  source.combat = { ...freshCombat(), freeze: 5 };
  restoreHealth(ally, 20, events, false, state, false, source);
  expect(source.health).toBe(4);
  expect(source.combat.freeze).toBe(2);
  expect(source.combat.thorns).toBe(1);
  expect(events.filter((event) => event.kind === "heal")).toHaveLength(2);
  restoreHealth(ally, 20, events, false, state, false, source);
  expect(source.health).toBe(4);
  restoreHealth(source, 1, events, false, state, false, source);
  expect(source.health).toBe(5);
});

it("Lovers Knot retains Healing bounce attribution without bouncing the returned Healing", () => {
  const state = structuredClone(teamRun(42, ["pollenmoth", "prismram", "reedstag"]));
  state.boons = ["lovers-knot"];
  state.discovery.recruited.pollenmoth = 6;
  const [healer, ally, other] = state.team;
  healer!.health = 1;
  ally!.health = species(ally!.species).health - 3;
  other!.health = species(other!.species).health - 6;
  const events: GameEvent[] = [];
  restoreHealth(ally!, 4, events, false, state, true, healer!);
  expect(healer!.health).toBe(12);
  expect(ally!.health).toBe(species(ally!.species).health);
  expect(other!.health).toBe(species(other!.species).health - 2);
  expect(events.filter((event) => event.kind === "heal")).toHaveLength(5);
});

it("Thaw Spoon removes buildup only for actual Health restored and retains active Freeze", () => {
  const { state, source, events } = fixture();
  state.boons = ["thaw-spoon", "sin-eaters-lantern", "orbit-armillary"];
  source.health = species(source.species).health - 2;
  source.combat = { ...freshCombat(), freeze: 5 };
  restoreHealth(source, 10, events, false, state);
  expect(source.combat.freeze).toBe(3);
  restoreHealth(source, 10, events, false, state);
  expect(source.combat.freeze).toBe(3);
  source.health--;
  source.combat.freeze = 0;
  source.combat.controlled = "freeze";
  source.combat.controlTurns = 1;
  restoreHealth(source, 1, events, false, state);
  expect(source.combat.controlled).toBe("freeze");
  expect(events.filter((event) => event.kind === "heal")).toHaveLength(3);
});

it("Cinder Fan splits decayed enemy Burn once through ordinary defenses without adding stacks", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["cinder-fan"];
  for (const enemy of state.battle!.enemies) {
    enemy.health = enemy.maxHealth = 100;
    enemy.block = 0;
    enemy.combat = freshCombat();
  }
  target.combat.burn = 9;
  target.combat.statusSources.burn = source.id;
  const others = state.battle!.enemies.filter((enemy) => enemy.id !== target.id);
  others[0]!.block = 1;
  const rng = state.rng;
  tickStatuses(state, target, events);
  expect(target.combat.burn).toBe(5);
  expect(target.health).toBe(91);
  expect(others.map((enemy) => enemy.health)).toEqual([99, 98]);
  expect(others.map((enemy) => enemy.combat.burn)).toEqual([0, 0]);
  expect(state.rng).toBe(rng);
});

it("Cinder Fan cannot spread enemy-attributed or source-less Burn", () => {
  const { state, target, events } = fixture();
  state.boons = ["cinder-fan"];
  target.combat.burn = 9;
  const others = state.battle!.enemies.filter((enemy) => enemy.id !== target.id);
  const health = others.map((enemy) => enemy.health);
  tickStatuses(state, target, events);
  expect(others.map((enemy) => enemy.health)).toEqual(health);
});

it("Moss Oven Mitt absorbs two Burn damage per Block while retaining buildup and normal tick rules", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["moss-oven-mitt"];
  source.block = 3;
  source.combat = freshCombat();
  const health = source.health;
  hit(state, target, source, 7, "burn", events, { origin: "proc" });
  expect(source.health).toBe(health - 1);
  expect(source.block).toBe(0);
  expect(source.combat.burn).toBe(7);
  source.block = 3;
  tickStatuses(state, source, events);
  expect(source.block).toBe(3);
  expect(source.health).toBe(health - 8);
});

it("Encore Baton counts accepted cards across turns and saves, excluding repeats and rejections", () => {
  let state = requireBattle(structuredClone(run()));
  state.boons = ["encore-baton"];
  const guards = state.cards.filter((card) => definition(card.definitionId).effect === "guard").slice(0, 2);
  const attack = state.cards.find((card) => definition(card.definitionId).name === "Prism Charge")!;
  state.battle.hand = guards.map((card) => card.id);
  state.battle.buffer = [];
  state.battle.discard = [];
  state.battle.draw = [
    ...state.cards
      .filter((card) => card.id !== attack.id && !state.battle.hand.includes(card.id))
      .map((card) => card.id),
    attack.id,
  ];
  state.battle.enemies.forEach((enemy) => {
    enemy.combat.controlled = "freeze";
    enemy.combat.controlTurns = 1;
  });
  for (const card of guards)
    state = requireBattle(
      accept(state, { type: "play", cardId: card.id, targetId: card.ownerId!, autoEndTurn: false }),
    );
  expect(state.battle.encoreProgress).toBe(2);
  state = requireBattle(accept(state, { type: "endTurn" }));
  expect(state.battle.encoreProgress).toBe(2);
  const encoded = encodeSave(state);
  const resumed = requireBattle(decodeSave(encoded));
  expect(dispatch(resumed, { type: "play", cardId: "missing" }).state).toBe(resumed);
  state = structuredClone(resumed);
  state.battle.repeatNext.player = true;
  const before = state.battle.hand.length;
  const preview = previewCard(state, attack.id, state.battle.enemies[0]!.id);
  const result = dispatch(state, {
    type: "play",
    cardId: attack.id,
    targetId: state.battle.enemies[0]!.id,
    autoEndTurn: false,
  });
  expect(result.accepted).toBe(true);
  expect(preview.state).toEqual(result.state);
  expect(result.state.battle!.encoreProgress).toBe(0);
  expect(result.state.battle!.hand).toHaveLength(before);
  expect(state.battle.encoreProgress).toBe(2);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  const noBoon = structuredClone(resumed);
  noBoon.boons = [];
  expect(() => decodeSave(encodeSave(noBoon))).toThrow();
});

it("Encore Baton draws again after another three cards and respects the shared overflow queue", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = ["encore-baton"];
  const before = state.battle.hand.length + state.battle.buffer.length;
  for (let card = 0; card < 6; card++) afterPlayerCard(state, []);
  expect(state.battle.hand.length + state.battle.buffer.length).toBe(before + 2);
  expect(state.battle.encoreProgress).toBe(0);
});

it("combines the complete Boon catalog without mutating previews or duplicating accepted-play rewards", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = BOONS.map((boon) => boon.id);
  state.battle.encoreProgress = 2;
  state.battle.cardsPlayedThisTurn = 2;
  const card = state.cards.find((entry) => entry.definitionId === "mossguard-heal")!;
  state.battle.hand = [card.id];
  state.battle.buffer = [];
  state.battle.discard = [];
  state.battle.draw = state.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
  for (const ally of state.team) {
    ally.health -= 4;
    ally.combat!.freeze = 5;
  }
  const encoded = encodeSave(state);
  const preview = previewCard(state, card.id);
  const result = dispatch(state, { type: "play", cardId: card.id, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(preview.state).toEqual(result.state);
  expect(encodeSave(state)).toBe(encoded);
  expect(result.state.battle!.encoreProgress).toBe(0);
  expect(result.state.battle!.hand).toHaveLength(1);
  expect(result.state.battle!.mana).toBe(state.battle.mana);
  expect(result.state.battleXP.health).toBe((state.battleXP.health ?? 0) + 1);
  expect(result.state.team.map((ally) => ally.combat!.freeze)).toEqual([1, 3, 3]);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});

it("Pruning Crescent steals full Nature Thorns through an authored pre-attack Purge", () => {
  const state = structuredClone(teamRun(42, ["euphera", "prismram", "reedstag"]));
  state.boons = ["pruning-crescent"];
  const actor = state.team[0]!;
  const target = state.battle!.enemies[0]!;
  target.health = target.maxHealth = 100;
  target.block = 0;
  target.combat = { ...freshCombat(), thorns: 8, waterThorns: 4, controlled: "freeze", controlTurns: 1 };
  const def = definition("euphera-twilight-lance");
  executeAbility(
    requireBattle(state),
    { side: "player", actor, def, value: def.value, targetId: target.id },
    [],
    { swap: () => undefined },
  );
  expect(actor.combat!.thorns).toBe(8);
  expect(actor.combat!.waterThorns).toBe(0);
  expect(target.combat.thorns).toBe(0);
  expect(target.combat.waterThorns).toBe(0);
});

it("Pruning Crescent collects team Purges but never steals from an allied victim", () => {
  const state = structuredClone(teamRun(42, ["rookhaven", "prismram", "reedstag"]));
  state.boons = ["pruning-crescent"];
  const actor = state.team[0]!;
  state.battle!.enemies.forEach((enemy, index) => {
    enemy.combat.thorns = (index + 1) * 2;
  });
  const def = definition("rookhaven-unwritten-ending");
  executeAbility(requireBattle(state), { side: "player", actor, def, value: def.value }, [], {
    swap: () => undefined,
  });
  expect(actor.combat!.thorns).toBe(12);
  removeEffects(actor, "purge", 100, [], state, undefined, state.battle!.enemies[0]!);
  expect(actor.combat!.thorns).toBe(0);
  expect(state.battle!.enemies[0]!.combat.thorns).toBe(0);
});

it("Knot Comb Cleanses before damage, triggering ordinary Cleanse rewards and source returns", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["knot-comb", "sin-eaters-lantern", "orbit-armillary"];
  source.health = 1;
  source.combat = { ...freshCombat(), poison: 2, statusSources: { poison: target.id } };
  const rng = state.rng;
  tickStatuses(state, source, events);
  expect(source.combat.poison).toBe(0);
  expect(source.health).toBe(7);
  expect(target.combat.poison).toBe(2);
  expect(state.rng).toBe(rng);
});

it("Knot Comb chooses one harmful category with seeded randomness and works in backup", () => {
  const { state, source, events } = fixture();
  state.boons = ["knot-comb"];
  source.combat = { ...freshCombat(), burn: 2, poison: 4 };
  state.team = state.team.filter((ally) => ally.id !== source.id);
  state.reserves = [source];
  tickStatuses(state, source, events);
  expect(source.combat.burn).toBe(0);
  expect(source.combat.poison).toBe(3);
  expect(state.rng).toBe(1083814273);
});

it("Rain Cape preserves allied Armor against Water through Block but leaves other wear intact", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["rain-cape"];
  source.combat = { ...freshCombat(), armor: 3 };
  source.block = 10;
  hit(state, target, source, 3, "water", events, { origin: "proc" });
  expect(source.combat.armor).toBe(3);
  expect(source.block).toBe(7);
  source.block = 0;
  const health = source.health;
  hit(state, target, source, 4, "physical", events, { origin: "proc" });
  expect(source.health).toBe(health - 1);
  expect(source.combat.armor).toBe(2);
  target.combat.armor = 3;
  hit(state, source, target, 3, "water", events, { origin: "proc" });
  expect(target.combat.armor).toBe(2);
});

it("Tuning Fork Charm shares Armor bypass with visible attack facts and preserves ordinary Armor wear", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["tuning-fork-charm"];
  target.combat = { ...freshCombat(), armor: 5, stun: 2 };
  const def = definition("prismram-attack");
  if (def.effect !== "attack") throw new Error("Expected Prism Charge");
  expect(ordinaryAttackFacts(requireBattle(state), source, def, 4, target)[0]!.lost).toBe(4);
  hit(state, source, target, 4, "physical", events, { origin: "proc" });
  expect(target.health).toBe(96);
  expect(target.combat.armor).toBe(4);
  target.combat.stun = 0;
  hit(state, source, target, 4, "physical", events, { origin: "proc" });
  expect(target.health).toBe(96);
  expect(target.combat.armor).toBe(4);
});

it("Rainkeeper preserves bounded overflow through save/resume and rejects overflow without the Boon", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = ["rainkeeper"];
  state.battle.mana = state.battle.maxMana;
  gainMana(state, 50, []);
  expect(state.battle.mana).toBe(state.battle.maxMana + 2);
  expect(decodeSave(encodeSave(state)).battle!.mana).toBe(state.battle.mana);
  state.boons = [];
  expect(() => decodeSave(encodeSave(state))).toThrow();
});

it("Dream Yo-Yo returns a Dodged card once without copies, free Mana or extra XP, including previews", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = ["dream-yo-yo"];
  const card = state.cards.find((card) => definition(card.definitionId).name === "Prism Charge")!;
  state.team.find((ally) => ally.id === card.ownerId)!.combat!.blind = true;
  state.rng = 1972;
  state.battle.hand = [card.id];
  state.battle.buffer = [];
  state.battle.discard = [];
  state.battle.draw = state.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
  const mana = state.battle.mana;
  const xp = state.battleXP.physical ?? 0;
  const preview = previewCard(state, card.id, "enemy-0");
  expect(preview.accepted).toBe(true);
  expect(preview.state.battle!.hand).toContain(card.id);
  expect(state.team.find((ally) => ally.id === card.ownerId)!.combat!.blind).toBe(true);
  const result = accept(state, { type: "play", cardId: card.id, targetId: "enemy-0", autoEndTurn: false });
  expect(result.battle!.hand).toContain(card.id);
  expect(result.battle!.mana).toBe(mana - 1);
  expect(result.battleXP.physical).toBe(xp + 1);
  expect(result.cards).toHaveLength(state.cards.length);
  expect(decodeSave(encodeSave(result))).toEqual(result);
  const zones = [
    ...result.battle!.hand,
    ...result.battle!.buffer,
    ...result.battle!.draw,
    ...result.battle!.discard,
  ];
  expect(zones.filter((id) => id === card.id)).toHaveLength(1);
});

it("Basalt Glass Bookmark preserves the final beneficial category through repeated and selective Purge", () => {
  const { state, source, events } = fixture();
  state.boons = ["basalt-glass-bookmark"];
  source.block = 8;
  source.combat = { ...freshCombat(), armor: 2, thorns: 3 };
  removeEffects(source, "purge", 99, events, state);
  expect(source.block).toBe(0);
  expect(source.combat.armor).toBe(0);
  expect(source.combat.thorns).toBe(3);
  removeEffects(source, "purge", 1, events, state, "thorns");
  expect(source.combat.thorns).toBe(3);
});

it("Wonder Domino conserves overkill across remaining enemies without new attacks or status buildup", () => {
  const { state, source, events } = fixture();
  state.boons = ["wonder-domino"];
  state.battle!.enemies.forEach((enemy, index) => {
    enemy.health = index === 0 ? 2 : index === 1 ? 3 : 30;
    enemy.block = 0;
    enemy.combat = { ...freshCombat(), controlled: "freeze", controlTurns: 1 };
  });
  hit(state, source, state.battle!.enemies[0]!, 10, "burn", events);
  expect(state.battle!.enemies.map((enemy) => enemy.health)).toEqual([0, 0, 25]);
  expect(state.battle!.enemies.slice(1).map((enemy) => enemy.combat.burn)).toEqual([0, 0]);
  expect(events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([2, 3, 5]);
});

it("Furnace Prism Blinds Burning enemies through ordinary status protection", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["furnace-prism"];
  target.combat.burn = 2;
  target.combat.nullify = true;
  hit(state, source, target, 1, "light", events);
  expect(target.combat.nullify).toBe(false);
  expect(target.combat.blind).toBe(false);
  hit(state, source, target, 1, "light", events);
  expect(target.combat.blind).toBe(true);
});

it("Last Threshold shares overflow from ordinary Healing without reviving or recursively amplifying it", () => {
  const { state, source, events } = fixture();
  state.boons = ["last-threshold"];
  source.health = species(source.species).health;
  const injured = state.team[0]!;
  injured.health = 1;
  injured.combat = { ...freshCombat(), deathDoorUsed: true, grace: 2 };
  const fallen = state.team[2]!;
  fallen.health = 0;
  fallen.combat = { ...freshCombat(), deathDoorUsed: true, grace: 1 };
  restoreHealth(source, 10, events, false, state);
  expect(source.health).toBe(species(source.species).health);
  expect(injured.health).toBe(11);
  expect(fallen.health).toBe(0);
  expect(events.filter((event) => event.kind === "heal")).toHaveLength(2);
});

it("Last Threshold applies Healing bonuses once before sharing the overflow", () => {
  const { state, source, events } = fixture();
  state.boons = ["last-threshold"];
  state.talents = ["health.mending"];
  source.health = species(source.species).health;
  const ally = state.team[0]!;
  ally.health = 1;
  ally.combat = { ...freshCombat(), deathDoorUsed: true, grace: 2 };
  restoreHealth(source, 10, events, false, state);
  expect(ally.health).toBe(12);
});

it("Camp Hammock includes living backups in automatic Healing while keeping them unselectable", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = ["camp-hammock"];
  const backup = {
    ...structuredClone(state.team[0]!),
    id: "hammock-backup",
    health: 1,
    combat: freshCombat(),
  };
  addBackups(state, backup);
  const card = state.cards.find((entry) => definition(entry.definitionId).name === "Moss Renewal")!;
  const def = definition(card.definitionId);
  executeAbility(state, { side: "player", actor: state.team[0]!, def, value: 2 }, [], {
    swap: () => undefined,
  });
  expect(backup.health).toBe(3);
  expect(playTargetError(state, definition("food-apple"), state.team[0]!.id, backup.id)).toBe(
    "Choose a living ally.",
  );
  expect(decodeSave(encodeSave(state)).reserves[0]!.health).toBe(3);
});

it("Honeycomb Frame prevents Critical Hits on the armored ally itself", () => {
  for (const protectedByBoon of [false, true]) {
    const { state, target: enemy, events } = fixture();
    state.boons = protectedByBoon ? ["honeycomb-frame"] : [];
    const ally = state.team[0]!;
    ally.block = 0;
    ally.health = species(ally.species).health;
    ally.combat = { ...freshCombat(), armor: 2, controlled: "freeze", controlTurns: 1 };
    state.rng = 1972;
    hit(state, enemy, ally, 4, "water", events);
    const damage = events.find((event) => event.kind === "damage");
    expect(damage).toMatchObject({ critical: !protectedByBoon, amount: protectedByBoon ? 4 : 8 });
  }
});

it("Undertow Castanets combines both buildups toward one control and preserves recovery immunity", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["undertow-castanets"];
  target.combat = freshCombat();
  state.rng = 1;
  hit(state, source, target, 30, "stun", events, { origin: "proc" });
  hit(state, source, target, 20, "freeze", events, { origin: "proc" });
  expect(target.combat).toMatchObject({ controlled: "freeze", stun: 0, freeze: 0 });
  startAction(target, events, state);
  expect(target.combat.cooldown).toBe(3);
  hit(state, source, target, 1, "stun", events, { origin: "proc" });
  expect(target.combat.controlled).toBeNull();
  expect(target.combat.stun).toBe(0);
});

it("Orbit Armillary returns removed effects to their source and respects Nullify without reflecting twice", () => {
  const { state, target: enemy, events } = fixture();
  state.boons = ["orbit-armillary"];
  const ally = state.team[0]!;
  ally.combat = freshCombat();
  hit(state, enemy, ally, 2, "poison", events, { origin: "proc" });
  enemy.combat.reflect = true;
  removeEffects(ally, "cleanse", 1, events, state);
  expect(ally.combat.poison).toBe(0);
  expect(enemy.combat.poison).toBe(2);
  expect(enemy.combat.reflect).toBe(true);
  applyBlind(state, enemy, ally, events);
  enemy.combat.nullify = true;
  removeEffects(ally, "cleanse", 1, events, state);
  expect(ally.combat.blind).toBe(false);
  expect(enemy.combat.blind).toBe(false);
  expect(enemy.combat.nullify).toBe(false);
});

it("Orbit Armillary persists the sources of control and Blind through save/resume", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = ["orbit-armillary"];
  const ally = state.team[0]!;
  ally.combat = freshCombat();
  const enemy = state.battle.enemies[0]!;
  applyBlind(state, enemy, ally, []);
  expect(decodeSave(encodeSave(state)).team[0]!.combat!.statusSources.blind).toBe(enemy.id);
  const events: GameEvent[] = [];
  enemy.combat = freshCombat();
  hit(state, enemy, ally, Math.ceil(species(ally.species).health / 2), "freeze", events, { origin: "proc" });
  expect(ally.combat.controlled).toBe("freeze");
  ally.combat.controlTurns = 2;
  const resumed = requireBattle(structuredClone(decodeSave(encodeSave(state))));
  removeEffects(resumed.team[0]!, "cleanse", 1, events, resumed);
  expect(resumed.team[0]!.combat!.controlled).toBeNull();
  expect(resumed.battle.enemies[0]!.combat).toMatchObject({ controlled: "freeze", controlTurns: 2 });
  beginAttack(state, ally, events);
  expect(ally.combat.statusSources.blind).toBeUndefined();
});

it("Last Threshold shares a finite overflow across eligible allies and cannot heal expired Death's Door", () => {
  const { state, source, events } = fixture();
  state.boons = ["last-threshold"];
  source.health = species(source.species).health;
  for (const ally of [state.team[0]!, state.team[2]!]) {
    ally.health = species(ally.species).health - 2;
    ally.combat = { ...freshCombat(), deathDoorUsed: true, grace: 1 };
  }
  restoreHealth(source, 3, events, false, state);
  expect(state.team[0]!.health + state.team[2]!.health).toBe(
    species(state.team[0]!.species).health + species(state.team[2]!.species).health - 1,
  );
  for (const ally of state.team) ally.combat!.grace = 0;
  const health = state.team.map((ally) => ally.health);
  restoreHealth(source, 99, events, false, state);
  expect(state.team.map((ally) => ally.health)).toEqual(health);
});

it("Camp Hammock lets automatic Mana Healing reach living backups without reviving fallen backups", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = ["camp-hammock", "rainkeeper"];
  state.talents = ["mana.arcane-mending"];
  const backup = {
    ...structuredClone(state.team[0]!),
    id: "healing-backup",
    health: 1,
    combat: freshCombat(),
  };
  const fallen = { ...structuredClone(backup), id: "fallen-backup", health: 0 };
  addBackups(state, backup, fallen);
  state.battle.mana = state.battle.maxMana;
  gainMana(state, 2, []);
  expect(backup.health).toBeGreaterThan(1);
  expect(fallen.health).toBe(0);
});
it("preserves Meteorite through triggered Burn for the next direct Burn hit", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["meteorite"];
  hit(state, source, target, 3, "burn", events, { origin: "proc" });
  expect(state.battle!.meteoriteUsed).toBe(false);
  hit(state, source, target, 5, "burn", events);
  expect(state.battle!.meteoriteUsed).toBe(true);
  expect(
    events
      .filter((event): event is Extract<GameEvent, { kind: "damage" }> => event.kind === "damage")
      .map((event) => event.amount),
  ).toEqual([3, 10]);
});
it("doubles only the first allied direct Burn hit across swaps, previews and resume", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["meteorite"];
  // A periodic packet neither consumes nor receives Meteorite.
  hit(state, source, target, 2, "burn", events, { origin: "periodic" as const });
  expect(state.battle!.meteoriteUsed).toBe(false);
  hit(state, source, target, 5, "burn", events);
  expect(
    events
      .filter((event): event is Extract<GameEvent, { kind: "damage" }> => event.kind === "damage")
      .map((event) => event.amount),
  ).toEqual([2, 10]);
  hit(state, source, target, 5, "burn", events);
  expect(
    events.filter((event): event is Extract<GameEvent, { kind: "damage" }> => event.kind === "damage").at(-1)!
      .amount,
  ).toBe(5);

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
  };
  expect(
    swapFixture(swappable, { type: "swap", activeId: swappable.team[1]!.id, reserve: reserve.id }).battle!
      .meteoriteUsed,
  ).toBe(true);
  const won = winBattle(played);
  const next = completeRecruitment(won);
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
  expect(
    events.filter(
      (event): event is Extract<GameEvent, { kind: "damage" }> =>
        event.kind === "damage" && event.damageType === "nature",
    ),
  ).toHaveLength(1);
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
  target.health = target.maxHealth;
  target.combat.controlled = null;
  target.combat.controlTurns = 0;
  hit(state, source, target, target.maxHealth / 2, "freeze", events, { origin: "proc" as const });
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
  const targetId = card.ownerId!;
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
it("allows blocked offensive effects while preserving Health-loss Gold rules and enemy ownership", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["cutpurse-knife", "parasitic-bloom", "lucky-clover", "brass-censer"];
  source.health = 10;
  for (const type of ["bleed", "poison", "nature", "light"] as const) {
    const currency = state.currency;
    target.block = 100;
    hit(state, source, target, 5, type, events, { origin: "proc" as const });
    expect(state.currency).toBe(currency + Number(type === "bleed"));
    expect(source.health).toBeGreaterThanOrEqual(10);
    const before = state.rng;
    const paid = state.currency;
    source.block = 100;
    hit(state, target, source, 5, type, events, { origin: "proc" as const });
    expect(state.rng).toBe(before);
    expect(state.currency).toBe(paid);
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
