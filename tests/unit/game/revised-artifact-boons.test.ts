import { prepareCombatFixture } from "../../support/combat";
import { expect, it } from "vitest";
import { run, teamRun, requireBattle, addBackups } from "../../support/game";
import { species, type CardDefinition } from "../../../src/game/content";
import { freshCombat, hit, removeEffects, tickStatuses, startAction } from "../../../src/game/combat/index";
import { resolveCombat } from "../../../src/game/combat/resolution";
import { controlThreshold } from "../../../src/game/combat/statuses";
import { summonEcho } from "../../../src/game/combat/legendary";
import { executeAbility } from "../../../src/game/combat/abilities";
import { finishTurn } from "../../../src/game/combat/turns";
import { observeDecisions } from "../../../src/game/random";
import { dispatch, previewCard } from "../../../src/game/engine";
import { cardCost } from "../../../src/game/ability-rules";
import { availablePlays, inspectCardPlay } from "../../../src/game/play-queries";
import { cardActor } from "../../../src/game/card-actors";
import { controlled } from "../../../src/game/combat/state";
import { encodeSave, decodeSave } from "../../../src/game/save";
import type { GameEvent } from "../../../src/game/types";

const ids = [
  "comb-uncapping-fork",
  "fern-fencing-foil",
  "resonance-kalimba",
  "miracle-megaphone",
  "blossom-cake-stand",
  "accordioned-bridge",
  "last-candle",
  "hearth-coal",
  "crescent-sextant",
  "reef-casket",
] as const;

function fixture(kinds?: Parameters<typeof teamRun>[1]) {
  const state = requireBattle(structuredClone(kinds ? teamRun(42, kinds) : run()));
  prepareCombatFixture(state, "all");
  return { state, ally: state.team[0]!, enemy: state.battle.enemies[0]!, events: [] as GameEvent[] };
}

function playAbility(f: ReturnType<typeof fixture>, def: CardDefinition) {
  executeAbility(f.state, { side: "player", actor: f.ally, def, value: def.value }, f.events);
}

it("Comb Uncapping Fork bypasses Block for allied Thorns without spending it", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["comb-uncapping-fork", "grain-flail"];
  Object.assign(ally.combat!, { thorns: 4 });
  enemy.block = 30;
  enemy.combat.armor = 3;
  hit(state, enemy, ally, 1, "water", events);
  expect(enemy.health).toBe(96);
  expect(enemy.block).toBe(30);
  expect(enemy.combat.armor).toBe(3);
  expect(enemy.combat.burn).toBe(0);
  expect(ally.combat!.thorns).toBe(3);
  expect(events.some((event) => event.kind === "block" && event.targetId === enemy.id)).toBe(false);
});

it("Comb Uncapping Fork leaves enemy Thorns and other retaliation under ordinary Block rules", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["comb-uncapping-fork", "resonance-kalimba"];
  ally.block = 10;
  enemy.combat.thorns = 4;
  hit(state, ally, enemy, 1, "water", events);
  expect(ally.block).toBe(6);
  expect(ally.combat!.stun).toBe(0);
  enemy.block = 10;
  hit(state, ally, enemy, 3, "poison", events, { origin: "statusRetaliation" });
  expect(enemy.block).toBe(7);
  expect(enemy.combat.stun).toBe(0);
});

it("the Fork and Kalimba also apply to Briar Racquet's half-strength Dodge retaliation", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["comb-uncapping-fork", "resonance-kalimba", "briar-racquet"];
  ally.combat!.thorns = 8;
  enemy.block = 20;
  observeDecisions(state, () => 0);
  hit(state, enemy, ally, 1, "physical", events);
  expect([enemy.health, enemy.block, enemy.combat.stun, ally.combat!.thorns]).toEqual([96, 20, 4, 7]);
});

it("Fern Fencing Foil Purges one category on a Dodge, including Blind misses, with normal Purge synergies", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["fern-fencing-foil", "prism-chisel"];
  enemy.combat.armor = 5;
  enemy.combat.thorns = 4;
  enemy.combat.blind = true;
  observeDecisions(state, () => 0);
  hit(state, enemy, ally, 3, "physical", events);
  expect(enemy.combat.armor).toBe(0);
  expect(enemy.combat.thorns).toBe(4);
  expect(enemy.health).toBe(95);
  expect(events.filter((event) => event.kind === "status" && event.status === "purge")).toHaveLength(1);
});

it("Resonance Kalimba adds buildup without extra damage, including Thorns absorbed by Block", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["resonance-kalimba"];
  Object.assign(ally.combat!, { thorns: 3 });
  enemy.block = 30;
  hit(state, enemy, ally, 1, "water", events);
  expect([enemy.health, enemy.block, enemy.combat.stun]).toEqual([100, 27, 3]);
  expect(events.filter((event) => event.kind === "damage" && event.damageType === "stun")).toHaveLength(0);
});

it("Kalimba control uses ordinary Nullify, immunity and control rewards", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["resonance-kalimba", "thunderstone"];
  ally.combat!.thorns = 50;
  enemy.combat.nullify = true;
  hit(state, enemy, ally, 1, "water", events);
  expect(enemy.combat.stun).toBe(0);
  expect(enemy.combat.nullify).toBe(false);
  enemy.combat.cooldown = 2;
  hit(state, enemy, ally, 1, "water", events);
  expect(enemy.combat.stun).toBe(0);
  enemy.health = 100;
  enemy.combat.cooldown = 0;
  ally.combat!.thorns = 50;
  hit(state, enemy, ally, 1, "water", events);
  expect(enemy.combat.controlled).toBe("stun");
  expect(enemy.health).toBe(44);
});

it("Miracle Megaphone Cleanses one category per deployed ally with each ally's normal rewards", () => {
  const { state, ally, events } = fixture();
  state.boons = ["miracle-megaphone", "sin-eaters-lantern"];
  for (const unit of state.team) {
    unit.health = 10;
    unit.combat!.burn = 3;
    unit.combat!.poison = 4;
  }
  expect(removeEffects(ally, "cleanse", 1, events, state)).toBe(3);
  expect(state.team.map((unit) => [unit.health, unit.combat!.burn, unit.combat!.poison])).toEqual([
    [16, 0, 4],
    [16, 0, 4],
    [16, 0, 4],
  ]);
});

it("Megaphone does not multiply already-grouped Cleanse or spread an enemy Cleanse", () => {
  const f = fixture();
  f.state.boons = ["miracle-megaphone"];
  for (const unit of f.state.team) Object.assign(unit.combat!, { burn: 3, poison: 4, bleed: 5 });
  playAbility(f, {
    id: "test-cleanse",
    name: "Cleanse",
    species: f.ally.species,
    cost: 1,
    effect: "teamCleanse",
    value: 1,
  });
  expect(f.state.team.map((unit) => [unit.combat!.burn, unit.combat!.poison, unit.combat!.bleed])).toEqual([
    [0, 4, 5],
    [0, 4, 5],
    [0, 4, 5],
  ]);
  f.enemy.combat.burn = 3;
  removeEffects(f.enemy, "cleanse", 1, f.events, f.state);
  expect(f.enemy.combat.burn).toBe(0);
  expect(f.state.team.every((unit) => unit.combat!.poison === 4)).toBe(true);
});

it("Megaphone shares selective buildup removal and partial Poison Cleanse without turning them into full Cleanse", () => {
  const { state, ally, events } = fixture();
  state.boons = ["miracle-megaphone"];
  for (const unit of state.team) Object.assign(unit.combat!, { freeze: 3, burn: 4 });
  resolveCombat("removeControlBuildup", state, ally, "freeze", events);
  expect(state.team.every((unit) => unit.combat!.freeze === 0 && unit.combat!.burn === 4)).toBe(true);
  state.boons.push("plague-doctors-mask");
  for (const unit of state.team) {
    unit.combat!.burn = 0;
    unit.combat!.poison = 5;
  }
  tickStatuses(state, ally, events);
  expect(state.team[1]!.combat!.poison).toBe(3);
  expect(state.team[2]!.combat!.poison).toBe(3);
});

it("Blossom Cake Stand allows zero-Mana Food, preserves creature grants and consumes each serving", () => {
  const state = requireBattle(structuredClone(run()));
  const ally = state.team[0]!;
  state.boons = ["blossom-cake-stand", "nectar-dipper"];
  state.battle.mana = 0;
  ally.combat!.freeCard = true;
  const bread = {
    id: "copy-0",
    definitionId: "food-trail-bread",
    ownerId: null,
    temporary: true as const,
    level: 0,
  };
  const berries = { ...bread, id: "copy-1", definitionId: "food-mana-berries" };
  state.cards.push(bread, berries);
  state.battle.copySerial = 2;
  state.battle.draw.push(...state.battle.hand);
  state.battle.hand = [bread.id, berries.id];
  expect(cardCost(bread, state)).toBe(0);
  expect(inspectCardPlay(state, bread.id).allowed).toBe(true);
  const first = dispatch(state, { type: "play", cardId: bread.id, targetId: ally.id });
  expect(first.accepted).toBe(true);
  const next = requireBattle(first.state);
  expect(next.battle.turn).toBe(state.battle.turn);
  expect(next.team[0]!.block).toBe(12);
  expect(next.team[0]!.combat!.freeCard).toBe(true);
  expect(next.cards.some((card) => card.id === bread.id)).toBe(false);
  const second = dispatch(next, { type: "play", cardId: berries.id });
  expect(second.accepted).toBe(true);
  expect(requireBattle(second.state).battle.mana).toBe(4);
  expect(second.state.cards.some((card) => card.id === berries.id)).toBe(false);
  expect(decodeSave(encodeSave(second.state))).toEqual(second.state);
});

it.each(["stun", "freeze"] as const)(
  "Accordioned Bridge permits swaps through %s but leaves other cards controlled",
  (status) => {
    const { state, ally } = fixture(["captoad", "mossguard", "prismram"]);
    state.boons = ["accordioned-bridge"];
    ally.combat!.controlled = status;
    ally.combat!.controlTurns = 2;
    addBackups(state, {
      id: "backup",
      species: "dunefox",
      health: species("dunefox").health,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    });
    const swap = state.cards.find((card) => card.definitionId === "captoad-swap")!;
    const other = state.cards.find((card) => card.definitionId === "captoad-attack")!;
    state.battle.hand = [swap.id, other.id];
    state.battle.draw = state.cards
      .filter((card) => !state.battle.hand.includes(card.id))
      .map((card) => card.id);
    state.battle.discard = [];
    state.battle.buffer = [];
    expect(inspectCardPlay(state, swap.id).allowed).toBe(true);
    expect(inspectCardPlay(state, other.id).allowed).toBe(false);
    expect(availablePlays(state).some((play) => play.card.id === swap.id)).toBe(true);
    const rejected = dispatch(state, {
      type: "play",
      cardId: other.id,
      targetId: state.battle.enemies[0]!.id,
    });
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(state);
    const result = dispatch(state, { type: "play", cardId: swap.id, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    expect(result.state.reserves.find((unit) => unit.id === ally.id)?.combat?.controlled).toBe(status);
    expect(result.state.team.some((unit) => unit.id === "backup")).toBe(true);
  },
);

it("Bridge uses the same controlled actor for borrowed swaps and prevents automatic loss of a playable turn", () => {
  const { state, ally, events } = fixture(["oathara", "captoad", "mossguard"]);
  state.boons = ["accordioned-bridge"];
  state.team[1]!.health = 0;
  for (const unit of [ally, state.team[2]!])
    Object.assign(unit.combat!, { controlled: "freeze", controlTurns: 3 });
  const swap = state.cards.find((card) => card.definitionId === "captoad-swap")!;
  state.battle.hand = [swap.id];
  expect(cardActor(state, swap)?.id).toBe(ally.id);
  expect(inspectCardPlay(state, swap.id).allowed).toBe(true);
  expect(controlled(ally, state)).toBe(true);
  for (const enemy of state.battle.enemies)
    Object.assign(enemy.combat, { controlled: "stun", controlTurns: 1 });
  const before = state.battle.turn;
  finishTurn(state, events);
  expect(state.battle.turn).toBe(before + 1);
});

it("Last Candle retains the final enemy Burn and its source after the source falls, but Cleanse extinguishes it", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["last-candle", "cinder-fan"];
  enemy.combat.burn = 1;
  enemy.combat.statusSources.burn = ally.id;
  ally.health = 0;
  tickStatuses(state, enemy, events);
  expect([enemy.health, enemy.combat.burn, enemy.combat.statusSources.burn]).toEqual([99, 1, ally.id]);
  expect(state.battle.enemies[1]!.combat.burn).toBe(0);
  removeEffects(enemy, "cleanse", 1, events, state);
  tickStatuses(state, enemy, events);
  expect(enemy.health).toBe(99);
  expect(enemy.combat.burn).toBe(0);
  expect(enemy.combat.statusSources.burn).toBeUndefined();
});

it("Last Candle preserves ordinary large-stack decay and leaves allied Burn unchanged", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["last-candle"];
  enemy.combat.burn = 5;
  tickStatuses(state, enemy, events);
  expect(enemy.combat.burn).toBe(3);
  ally.combat!.burn = 1;
  tickStatuses(state, ally, events);
  expect(ally.combat!.burn).toBe(0);
});

it.each(["ability", "periodic", "statusRetaliation"] as const)(
  "Hearth Coal stops lethal %s Burn without spending Death's Door",
  (origin) => {
    const { state, ally, enemy, events } = fixture();
    state.boons = ["hearth-coal"];
    ally.health = 5;
    hit(state, enemy, ally, 100, "burn", events, { origin });
    expect(ally.health).toBe(1);
    expect(ally.combat!.deathDoorUsed).toBe(false);
    hit(state, enemy, ally, 100, "burn", events, { origin });
    expect(ally.health).toBe(1);
    expect(ally.combat!.deathDoorUsed).toBe(false);
    hit(state, enemy, ally, 1, "water", events);
    expect(ally.combat!.deathDoorUsed).toBe(true);
  },
);

it("Hearth Coal preserves Block absorption and does not save Burning enemies", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["hearth-coal"];
  ally.health = 5;
  ally.block = 10;
  hit(state, enemy, ally, 6, "burn", events);
  expect([ally.health, ally.block]).toEqual([5, 4]);
  enemy.health = 3;
  hit(state, ally, enemy, 9, "burn", events);
  expect(enemy.health).toBe(0);
});

it("Crescent Sextant uses remaining Health after damage, with normal control immunity", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["crescent-sextant"];
  enemy.health = 20;
  hit(state, ally, enemy, 6, "stun", events);
  expect([enemy.health, enemy.combat.stun, enemy.combat.controlled]).toEqual([14, 6, null]);
  hit(state, ally, enemy, 1, "stun", events);
  expect(enemy.combat.controlled).toBe("stun");
  startAction(enemy, events, state);
  resolveCombat("applyHarmfulStatus", state, ally, enemy, 100, "freeze", events);
  expect(enemy.combat.controlled).toBe(null);
  expect(enemy.combat.freeze).toBe(0);
});

it("Sextant shares reduced thresholds with Undertow Castanets and preserves allied thresholds", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["crescent-sextant", "undertow-castanets"];
  state.talents = ["freeze.bitter-cold", "stun.concussive-force"];
  enemy.health = 20;
  const stun = controlThreshold(state, ally, enemy, "stun");
  const freeze = controlThreshold(state, ally, enemy, "freeze");
  enemy.combat.stun = Math.ceil(stun / 2);
  resolveCombat("applyHarmfulStatus", state, ally, enemy, Math.ceil(freeze / 2), "freeze", events);
  expect(enemy.combat.controlled).toBe("freeze");
  ally.health = 1;
  expect(controlThreshold(state, enemy, ally, "freeze")).toBe(species(ally.species).health / 2);
});

it("Reef Casket preserves Nullify while Block remains, then consumes it on the breaking hit", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["reef-casket", "coronation-cloche"];
  ally.block = 10;
  ally.combat!.nullify = true;
  hit(state, enemy, ally, 3, "poison", events);
  hit(state, enemy, ally, 3, "burn", events);
  expect([ally.block, ally.combat!.nullify, ally.combat!.poison, ally.combat!.burn]).toEqual([4, true, 0, 0]);
  removeEffects(ally, "purge", 3, events, state, undefined, enemy);
  expect([ally.block, ally.combat!.nullify]).toEqual([4, true]);
  hit(state, enemy, ally, 4, "freeze", events);
  expect([ally.block, ally.combat!.nullify, ally.combat!.freeze]).toEqual([0, false, 0]);
  expect(ally.health).toBe(species(ally.species).health);
});

it("Reef Casket does not preserve enemy Nullify or stop an ordinary Purge", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["reef-casket"];
  ally.block = 4;
  ally.combat!.nullify = true;
  removeEffects(ally, "purge", 2, events, state, undefined, enemy);
  expect([ally.block, ally.combat!.nullify]).toEqual([0, false]);
  enemy.block = 4;
  enemy.combat.nullify = true;
  hit(state, ally, enemy, 1, "poison", events);
  expect(enemy.combat.nullify).toBe(false);
});

it.each([false, true])(
  "returned control retains its base strength and ordinary overflow; Sextant %s",
  (sextant) => {
    const { state, ally, enemy, events } = fixture();
    state.boons = ["orbit-armillary", "wonder-ball-maze", ...(sextant ? ["crescent-sextant" as const] : [])];
    state.talents = ["freeze.bitter-cold"];
    enemy.health = sextant ? 20 : 100;
    Object.assign(ally.combat!, { controlled: "freeze", controlTurns: 2 });
    ally.combat!.statusSources.freeze = enemy.id;
    const packet = enemy.health / 2;
    const excess = Math.floor(packet - controlThreshold(state, ally, enemy, "freeze"));
    removeEffects(ally, "cleanse", 1, events, state);
    expect(enemy.combat.controlled).toBe("freeze");
    expect(enemy.combat.controlTurns).toBe(2);
    expect(state.battle.enemies[1]!.combat.freeze).toBe(excess);
  },
);

it("the new protection, Thorns and Cleanse rules include allied Minions", () => {
  const { state, ally, enemy, events } = fixture(["memento"]);
  state.boons = [
    "comb-uncapping-fork",
    "resonance-kalimba",
    "hearth-coal",
    "reef-casket",
    "miracle-megaphone",
  ];
  summonEcho(state, ally, "player", 5, events);
  const echo = state.battle.minions![0]!;
  Object.assign(echo.combat, { thorns: 4, nullify: true });
  echo.block = 5;
  enemy.block = 20;
  hit(state, enemy, echo, 100, "burn", events);
  expect([echo.health, echo.block, echo.combat.nullify]).toEqual([1, 0, false]);
  expect([enemy.health, enemy.block, enemy.combat.stun]).toEqual([96, 20, 4]);
  echo.block = 2;
  echo.combat.nullify = true;
  hit(state, enemy, echo, 1, "poison", events);
  expect([echo.health, echo.block, echo.combat.nullify, echo.combat.poison]).toEqual([1, 1, true, 0]);
  echo.combat.burn = 3;
  removeEffects(ally, "cleanse", 1, events, state);
  expect(echo.combat.burn).toBe(0);
});

it("combined Boons retain deterministic preview, committed outcomes and resume", () => {
  const state = requireBattle(structuredClone(run()));
  const enemy = state.battle.enemies[0]!;
  state.boons = [...ids];
  state.battle.mana = 4;
  enemy.health = 20;
  enemy.combat.burn = 1;
  const card = state.cards.find((card) => card.definitionId === "prismram-spectrum-lance")!;
  const all = state.cards.map((entry) => entry.id);
  state.battle.hand = [card.id];
  state.battle.draw = all.filter((id) => id !== card.id);
  state.battle.discard = [];
  state.battle.buffer = [];
  const serialized = encodeSave(state);
  const preview = previewCard(state, card.id, enemy.id);
  const command = { type: "play" as const, cardId: card.id, targetId: enemy.id, autoEndTurn: false };
  const committed = dispatch(state, command);
  expect(committed.accepted).toBe(true);
  expect(preview.accepted).toBe(true);
  expect(preview.state).toEqual(committed.state);
  expect(encodeSave(state)).toBe(serialized);
  expect(decodeSave(encodeSave(committed.state))).toEqual(committed.state);
  const resumed = dispatch(decodeSave(serialized), command);
  expect(resumed).toEqual(committed);
});
