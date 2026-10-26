import { expect, it } from "vitest";
import { run, requireBattle } from "../../support/game";
import { BOONS, definition } from "../../../src/game/content";
import { freshCombat, hit, removeEffects } from "../../../src/game/combat/index";
import { resolveCombat } from "../../../src/game/combat/resolution";
import { decayBlock } from "../../../src/game/combat/turns";
import { executeAbility } from "../../../src/game/combat/abilities";
import { advanceControlImmunity } from "../../../src/game/combat/status-state";
import { drawDiscard, fillHand, handCapacity, recoverBrokenGuard } from "../../../src/game/card-zones";
import { returnDodgedCard } from "../../../src/game/combat/card-modifiers";
import { observeDecisions } from "../../../src/game/random";
import { dispatch, previewCard } from "../../../src/game/engine";
import { encodeSave, decodeSave } from "../../../src/game/save";
import type { GameEvent } from "../../../src/game/types";

function fixture() {
  const state = requireBattle(structuredClone(run()));
  state.boons = [];
  state.talents = [];
  for (const unit of [...state.team, ...state.battle.enemies]) {
    unit.block = 0;
    unit.combat = freshCombat();
  }
  for (const enemy of state.battle.enemies) enemy.health = enemy.maxHealth = 100;
  observeDecisions(state, () => 0.99);
  return { state, source: state.team[1]!, target: state.battle.enemies[0]!, events: [] as GameEvent[] };
}

it("Geode Anvil retains an Armor floor without creating Block or inflating decay rewards", () => {
  const { state, source, events } = fixture();
  state.boons = ["geode-anvil", "pleated-pagoda"];
  source.block = 10;
  source.combat!.armor = 8;
  decayBlock(state, source, events);
  expect([source.block, source.combat!.armor]).toEqual([8, 9]);
  decayBlock(state, source, events);
  expect([source.block, source.combat!.armor]).toEqual([8, 9]);
  source.block = 2;
  decayBlock(state, source, events);
  expect(source.block).toBe(2);
  const enemy = state.battle.enemies[0]!;
  enemy.block = 10;
  enemy.combat.armor = 30;
  decayBlock(state, enemy, events);
  expect(enemy.block).toBe(5);
});

it("Journey Loom draws another owner's card after a recovered card, with ordinary draw rewards", () => {
  const { state, source, events } = fixture();
  state.boons = ["journey-loom", "dune-shuttle"];
  const returned = state.cards.find((card) => card.ownerId === source.id)!;
  const other = state.cards.find((card) => card.ownerId === state.team[0]!.id)!;
  state.battle.hand = [];
  state.battle.buffer = [];
  state.battle.discard = [returned.id];
  state.battle.draw = [other.id];
  expect(drawDiscard(state, events)?.id).toBe(returned.id);
  expect(state.battle.hand).toEqual([returned.id, other.id]);
  expect(state.team[0]!.block).toBe(1);
  expect(source.block).toBe(1);
});

it("Journey Loom follows Cloud Cup-and-Ball and Dream Yo-Yo returns without returning copies", () => {
  const { state, source, events } = fixture();
  state.boons = ["journey-loom", "cloud-cup-and-ball", "dream-yo-yo"];
  const returned = state.cards.find((card) => card.ownerId === source.id)!;
  const others = state.cards.filter((card) => card.ownerId === state.team[0]!.id).slice(0, 2);
  state.battle.hand = [];
  state.battle.buffer = [];
  state.battle.discard = [returned.id];
  state.battle.draw = others.map((card) => card.id);
  recoverBrokenGuard(state, source.id, events);
  expect(state.battle.hand).toHaveLength(2);
  state.battle.hand.splice(state.battle.hand.indexOf(returned.id), 1);
  state.battle.discard.push(returned.id);
  events.push({
    kind: "status",
    targetId: state.battle.enemies[0]!.id,
    status: "dodge",
    outcome: "dodge",
    text: "Dodge",
  });
  returnDodgedCard(state, returned, events, 0);
  expect(state.battle.hand).toHaveLength(3);
  expect(state.battle.hand.filter((id) => id === returned.id)).toHaveLength(1);
});

it("Journey Loom adds no card when another living deployed owner has none available", () => {
  const { state, source, events } = fixture();
  state.boons = ["journey-loom", "cloud-cup-and-ball"];
  const cards = state.cards.filter((card) => card.ownerId === source.id);
  state.battle.hand = [];
  state.battle.buffer = [];
  state.battle.discard = [cards[0]!.id];
  state.battle.draw = [cards[1]!.id];
  recoverBrokenGuard(state, source.id, events);
  expect(state.battle.hand).toEqual([cards[0]!.id]);
});

function areaAttack(f: ReturnType<typeof fixture>, repeat = false) {
  const original = definition("mossguard-attack");
  if (original.effect !== "attack") throw new Error("Expected attack");
  executeAbility(
    f.state,
    {
      side: "enemy",
      actor: f.target,
      value: 4,
      def: {
        ...original,
        damageType: "physical",
        repeatChance: repeat ? 100 : undefined,
        effects: [{ kind: "blind", amount: 1 }],
      },
    },
    f.events,
    { swap: () => undefined },
  );
}

it("Devotion Clasp shelters the most injured area recipient before a later ward bearer, including harmful extras", () => {
  const f = fixture();
  f.state.boons = ["devotion-clasp"];
  const [first, middle, bearer] = f.state.team;
  first!.health = 10;
  bearer!.combat!.negate = true;
  const before = f.state.team.map((unit) => unit.health);
  areaAttack(f);
  expect(f.state.team.map((unit) => unit.health)).toEqual([before[0], before[1]! - 4, before[2]]);
  expect(f.state.team.map((unit) => unit.combat!.blind)).toEqual([false, true, false]);
  expect(bearer!.combat!.negate).toBe(false);
  expect(middle!.combat!.negate).toBe(false);
});

it("Devotion Clasp spends one existing ward and leaves no protection for a repeat", () => {
  const f = fixture();
  f.state.boons = ["devotion-clasp"];
  f.state.team[0]!.health = 10;
  f.state.team[2]!.combat!.negate = true;
  const before = f.state.team.map((unit) => unit.health);
  areaAttack(f, true);
  expect(f.state.team.map((unit) => unit.health)).toEqual([before[0]! - 4, before[1]! - 8, before[2]! - 4]);
  expect(f.events.filter((event) => event.kind === "status" && event.status === "negate")).toHaveLength(2);
});

it("Devotion Clasp leaves wards intact when Blind causes an area attack to miss", () => {
  const f = fixture();
  f.state.boons = ["devotion-clasp"];
  f.state.team[2]!.combat!.negate = true;
  f.target.combat.blind = true;
  observeDecisions(f.state, () => 0);
  areaAttack(f);
  expect(f.state.team[2]!.combat!.negate).toBe(true);
  expect(f.events.filter((event) => event.kind === "damage")).toHaveLength(0);
});

it("Prism Chisel damages only the enemy whose Armor was actually Purged, through ordinary Block", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["prism-chisel"];
  target.block = 4;
  target.combat.armor = 6;
  removeEffects(target, "purge", 1, events, state, "armor", source);
  expect([target.health, target.block, target.combat.armor]).toEqual([98, 0, 0]);
  source.combat!.armor = 5;
  const health = source.health;
  removeEffects(source, "purge", 1, events, state, "armor", target);
  expect(source.health).toBe(health);
});

it("Eclipse Protractor adds only the mitigated critical bonus as Freeze build-up, including blocked hits", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["eclipse-protractor"];
  target.block = 100;
  target.combat.armor = 8;
  hit(state, source, target, 6, "physical", events, { origin: "ability", criticalBonus: 100 });
  expect(target.health).toBe(100);
  expect(target.combat.freeze).toBe(4);
  expect(events.filter((event) => event.kind === "damage")).toHaveLength(1);
});

it("Eclipse Protractor's additional build-up respects Nullify and creates no second damage packet", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["eclipse-protractor"];
  target.combat.nullify = true;
  hit(state, source, target, 6, "physical", events, { origin: "ability", criticalBonus: 100 });
  expect(target.combat.freeze).toBe(0);
  expect(target.combat.nullify).toBe(false);
  expect(target.health).toBe(88);
});

it("Wonder Ball Maze conserves excess build-up across successful controls without adding damage", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["wonder-ball-maze"];
  target.combat.stun = 45;
  resolveCombat("applyHarmfulStatus", state, source, target, 60, "stun", events);
  expect(state.battle.enemies.map((enemy) => [enemy.combat.controlled, enemy.combat.stun])).toEqual([
    ["stun", 0],
    ["stun", 0],
    [null, 5],
  ]);
  expect(state.battle.enemies.map((enemy) => enemy.health)).toEqual([100, 100, 100]);
});

it("Wonder Ball Maze converts mixed threshold fractions once with Undertow Castanets", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["wonder-ball-maze", "undertow-castanets"];
  state.talents = ["freeze.bitter-cold"];
  target.combat.freeze = 20;
  target.combat.stun = 20;
  resolveCombat("applyHarmfulStatus", state, source, target, 15, "stun", events);
  expect(target.combat.controlled).toBe("stun");
  expect(target.combat.freeze).toBe(0);
  expect(state.battle.enemies[1]!.combat.stun).toBe(10);
});

it("Wonder Ball Maze cannot spill prevented control or pass through an alternate target's Nullify", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["wonder-ball-maze"];
  target.combat.cooldown = 2;
  resolveCombat("applyHarmfulStatus", state, source, target, 100, "stun", events);
  expect(state.battle.enemies[1]!.combat.stun).toBe(0);
  target.combat.cooldown = 0;
  state.battle.enemies[1]!.combat.nullify = true;
  resolveCombat("applyHarmfulStatus", state, source, target, 100, "stun", events);
  expect(state.battle.enemies[1]!.combat.nullify).toBe(false);
  expect(state.battle.enemies[2]!.combat.stun).toBe(0);
});

it("Sleepers Urn stores build-up through the full immunity window, then waits for another hit", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["sleepers-urn"];
  target.combat.cooldown = 3;
  resolveCombat("applyHarmfulStatus", state, source, target, 60, "freeze", events);
  expect(target.combat).toMatchObject({ freeze: 60, controlled: null, cooldown: 3 });
  advanceControlImmunity(target.combat);
  advanceControlImmunity(target.combat);
  advanceControlImmunity(target.combat);
  expect(target.combat.controlled).toBe(null);
  resolveCombat("applyHarmfulStatus", state, source, target, 1, "freeze", events);
  expect(target.combat.controlled).toBe("freeze");
});

it("Sleepers Urn respects wards and cannot accumulate during active control or help enemy sources", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["sleepers-urn"];
  target.combat.cooldown = 2;
  target.combat.nullify = true;
  resolveCombat("applyHarmfulStatus", state, source, target, 10, "freeze", events);
  expect(target.combat.freeze).toBe(0);
  target.combat.cooldown = 0;
  target.combat.controlled = "stun";
  target.combat.controlTurns = 1;
  resolveCombat("applyHarmfulStatus", state, source, target, 10, "freeze", events);
  expect(target.combat.freeze).toBe(0);
  source.combat!.cooldown = 2;
  resolveCombat("applyHarmfulStatus", state, target, source, 10, "freeze", events);
  expect(source.combat!.freeze).toBe(0);
});

it("Facet Abacus grants exactly one FIFO hand slot independent of Mana and rejects unsupported saved capacity", () => {
  const state = requireBattle(structuredClone(run()));
  const ids = state.cards.map((card) => card.id);
  state.battle.hand = ids.slice(0, 6);
  state.battle.buffer = ids.slice(6);
  state.battle.draw = [];
  state.battle.discard = [];
  fillHand(state);
  expect(state.battle.hand).toHaveLength(6);
  state.boons = ["facet-abacus"];
  fillHand(state);
  expect(state.battle.hand).toEqual(ids.slice(0, 7));
  expect(state.battle.buffer).toEqual(ids.slice(7));
  expect(handCapacity(state)).toBe(7);
  state.battle.maxMana = 7;
  expect(handCapacity(state)).toBe(7);
  const restored = decodeSave(encodeSave(state));
  expect(restored?.battle?.hand).toEqual(ids.slice(0, 7));
  const without = structuredClone(state);
  without.boons = [];
  expect(() => decodeSave(encodeSave(without))).toThrow();
  const eighth = structuredClone(state);
  eighth.battle.hand.push(eighth.battle.buffer.shift()!);
  expect(() => decodeSave(encodeSave(eighth))).toThrow();
});

it.each(["thorns", "waterThorns", "fireThorns"] as const)(
  "Thornheart Ring preserves %s only against Bleeding attackers",
  (status) => {
    const { state, source, target, events } = fixture();
    state.boons = ["thornheart-ring"];
    source.combat![status] = 4;
    target.combat.bleed = 2;
    hit(state, target, source, 1, "physical", events);
    expect(source.combat![status]).toBe(4);
    target.combat.bleed = 0;
    hit(state, target, source, 1, "physical", events);
    expect(source.combat![status]).toBe(3);
  },
);

it("Moonboat Toy prevents all three Thorns packets while preserving ordinary stack loss", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["moonboat-toy"];
  Object.assign(target.combat, { thorns: 2, waterThorns: 3, fireThorns: 4 });
  const health = source.health;
  hit(state, source, target, 6, "water", events);
  expect(source.health).toBe(health);
  expect(source.combat!.burn).toBe(0);
  expect(target.combat).toMatchObject({ thorns: 1, waterThorns: 2, fireThorns: 3 });
  hit(state, source, target, 1, "physical", events);
  expect(source.health).toBeLessThan(health);
});

it("The new Boons preserve rejected commands and authoritative previews across save/resume", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = [
    "geode-anvil",
    "journey-loom",
    "devotion-clasp",
    "prism-chisel",
    "eclipse-protractor",
    "wonder-ball-maze",
    "sleepers-urn",
    "facet-abacus",
    "thornheart-ring",
    "moonboat-toy",
  ];
  const before = encodeSave(state);
  const rejected = dispatch(state, { type: "play", cardId: "absent", targetId: state.battle.enemies[0]!.id });
  expect(rejected.accepted).toBe(false);
  expect(encodeSave(state)).toBe(before);
  const card = state.battle.hand.find(
    (id) => definition(state.cards.find((card) => card.id === id)!.definitionId).effect === "attack",
  )!;
  const target = state.battle.enemies[0]!.id;
  const preview = previewCard(state, card, target);
  expect(encodeSave(state)).toBe(before);
  const played = dispatch(state, { type: "play", cardId: card, targetId: target });
  expect(played.accepted).toBe(true);
  expect(preview.state).toEqual(played.state);
  expect(decodeSave(encodeSave(played.state))).toEqual(played.state);
  expect(BOONS.filter((boon) => state.boons.includes(boon.id))).toHaveLength(10);
});

it("Devotion Clasp preserves an ally's own ward when the shared charge already shields them", () => {
  const f = fixture();
  f.state.boons = ["devotion-clasp"];
  for (const ally of f.state.team) ally.combat!.negate = true;
  f.state.team[1]!.health = 10;
  const before = f.state.team.map((unit) => unit.health);
  areaAttack(f);
  expect(f.state.team.map((unit) => unit.health)).toEqual(before);
  expect(f.state.team[1]!.combat!.negate).toBe(true);
});

it("Thornheart Ring also preserves Briar Racquet retaliation against a Bleeding attacker", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["thornheart-ring", "briar-racquet"];
  source.combat!.thorns = 4;
  source.combat!.dodge = 70;
  target.combat.bleed = 1;
  observeDecisions(state, () => 0);
  hit(state, target, source, 1, "physical", events);
  expect(source.combat!.thorns).toBe(4);
  expect(target.health).toBe(98);
});

it("Sleepers Urn persists stored build-up and immunity in a current-format save", () => {
  const state = requireBattle(structuredClone(run()));
  state.boons = ["sleepers-urn"];
  const target = state.battle.enemies[0]!;
  target.combat = { ...freshCombat(), cooldown: 2 };
  resolveCombat("applyHarmfulStatus", state, state.team[1]!, target, 100, "stun", []);
  const resumed = requireBattle(decodeSave(encodeSave(state)));
  expect(resumed.battle.enemies[0]!.combat).toMatchObject({ stun: 100, controlled: null, cooldown: 2 });
});

it("Moonboat Toy still wears down Thorns when an enemy Negates the Water attack", () => {
  const { state, source, target, events } = fixture();
  state.boons = ["moonboat-toy"];
  Object.assign(target.combat, { negate: true, thorns: 4, waterThorns: 3, fireThorns: 2 });
  const before = source.health;
  hit(state, source, target, 6, "water", events);
  expect(source.health).toBe(before);
  expect(target.health).toBe(100);
  expect(target.combat).toMatchObject({ negate: false, thorns: 3, waterThorns: 2, fireThorns: 1 });
  expect(events.some((event) => event.text.includes("Thorns still retaliate"))).toBe(false);
});
