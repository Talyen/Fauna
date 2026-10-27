import { expect, it } from "vitest";
import { BOONS, definition } from "../../../src/game/content";
import { validateContent } from "../../../src/game/content-validation";
import { freshCombat, hit, removeEffects, restoreHealth, tickStatuses } from "../../../src/game/combat";
import { resolveCombat } from "../../../src/game/combat/resolution";
import { observeDecisions } from "../../../src/game/random";
import { requireBattle, run, teamRun } from "../../support/game";
import { setBattleCards } from "../../support/cards";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import prepared from "../../../src/assets/prepared.json";
import { NEW_BOON_EFFECTS } from "../../support/boons";
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
  return { state, source: state.team[1]!, enemy: state.battle.enemies[0]!, events: [] as GameEvent[] };
}

it("registers the ten distinct Boons and their exact rules", () => {
  const expected = [
    "bellows-heart",
    "leafwing-shuttlecock",
    "soot-brush",
    "echo-ocarina",
    "glassleaf-shield",
    "harvest-shears",
    "frostglass-die",
    "reef-diadem",
    "chromatic-viol",
    "mirror-locket",
  ];
  for (const id of expected) {
    const text = NEW_BOON_EFFECTS[id as keyof typeof NEW_BOON_EFFECTS];
    expect(BOONS.find((boon) => boon.id === id)?.text).toBe(text);
    expect(Object.hasOwn(prepared.records, `boon.${id}`)).toBe(true);
  }
  expect(validateContent).not.toThrow();
});

it("shares a Dodge and deals actual Stun damage without responding to a Thorns Dodge", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["leafwing-shuttlecock", "echo-ocarina", "rootvault-pole"];
  hit(state, enemy, source, 4, "physical", events, { origin: "ability", blindMiss: true });
  expect(enemy.health).toBe(98);
  expect(enemy.combat.stun).toBe(2);
  expect(state.team[0]!.combat!.temporaryDodge).toBe(10);
  expect(source.combat!.temporaryDodge).toBe(0);
  source.combat!.dodge = 70;
  observeDecisions(state, () => 0);
  hit(state, enemy, source, 4, "nature", events, { origin: "retaliation", thorns: true });
  expect(enemy.health).toBe(98);
  expect(state.team[0]!.combat!.temporaryDodge).toBe(20);
});

it("Cleanses Blind with Burn and grants existing Cleanse rewards only once per effect", () => {
  const { state, source, events } = fixture();
  state.boons = ["soot-brush", "calendula-soap"];
  source.combat!.burn = 4;
  source.combat!.blind = true;
  expect(removeEffects(source, "cleanse", 1, events, state)).toBe(2);
  expect([source.combat!.burn, source.combat!.blind, source.combat!.nullify]).toEqual([0, false, true]);
  expect(events.filter((event) => event.kind === "status" && event.outcome === "remove")).toHaveLength(2);
});

it("halves the damage remaining after Block without reducing status buildup", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["glassleaf-shield"];
  const health = source.health;
  source.block = 4;
  hit(state, enemy, source, 10, "burn", events);
  expect(source.block).toBe(0);
  expect(source.health).toBe(health - 3);
  expect(source.combat!.burn).toBe(10);
});

it("preserves Ravelland's Block-break Armor after the Shield reduces the same hit", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["ravelland"])));
  const ally = state.team[0]!;
  const enemy = state.battle.enemies[0]!;
  const before = ally.health;
  const events: GameEvent[] = [];
  state.boons = ["glassleaf-shield"];
  state.talents = [];
  ally.combat = freshCombat();
  ally.block = 4;
  observeDecisions(state, () => 0.99);
  hit(state, enemy, ally, 10, "physical", events);
  expect(ally.health).toBe(before - 3);
  expect(ally.combat.armor).toBe(1);
});

it("shares Bleed after a defeat and leaves the existing hit and its source intact", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["harvest-shears"];
  const other = state.battle.enemies[1]!;
  enemy.health = 2;
  enemy.combat.bleed = 6;
  enemy.combat.statusSources.bleed = source.id;
  hit(state, source, enemy, 4, "physical", events);
  expect(enemy.health).toBe(0);
  expect(other.combat.bleed).toBe(6);
  expect(other.combat.statusSources.bleed).toBe(source.id);
});

it("spreads Bleed on its own fatal tick without paying its Leech twice", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["harvest-shears"];
  source.health -= 8;
  const before = source.health;
  enemy.health = 4;
  enemy.combat.bleed = 6;
  enemy.combat.statusSources.bleed = source.id;
  enemy.combat.bleedLeech = [{ sourceId: source.id, amount: 6 }];
  tickStatuses(state, enemy, events);
  expect(state.battle.enemies[1]!.combat.bleed).toBe(6);
  expect(source.health - before).toBe(2);
  expect(state.battle.enemies[1]!.combat.bleedLeech).toEqual([]);
});

it("uses real Burn damage for Freeze hits, including damage stopped by a Freeze ward", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["frostglass-die"];
  enemy.combat.nullifyFreeze = true;
  hit(state, source, enemy, 6, "freeze", events);
  expect(enemy.health).toBe(98);
  expect(enemy.combat.freeze).toBe(0);
  expect(enemy.combat.burn).toBe(2);
});

it("settles Freeze before supplemental Burn and respects ordinary Burn protection", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["frostglass-die"];
  enemy.health = 6;
  hit(state, source, enemy, 4, "freeze", events);
  expect(enemy.health).toBe(0);
  expect(enemy.combat.freeze).toBe(4);
  const second = state.battle.enemies[1]!;
  second.combat.nullify = true;
  hit(state, source, second, 4, "freeze", events);
  expect(second.combat.freeze).toBe(0);
  expect(second.combat.burn).toBe(2);
});

it("does not displace an existing Freeze reward when its bonus damage defeats the enemy", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["frostglass-die", "icy-heart"];
  enemy.health = 9;
  enemy.combat.freeze = 49;
  hit(state, source, enemy, 4, "freeze", events);
  expect(enemy.health).toBe(0);
  expect(enemy.combat.burn).toBe(0);
  expect(events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([4, 5]);
});

it("combines Water, Thorns and distinct harmful effects without multiplying the extra hit", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["reef-diadem", "chromatic-viol"];
  source.combat!.thorns = 6;
  enemy.combat.poison = 5;
  enemy.combat.blind = true;
  hit(state, source, enemy, 5, "water", events);
  expect(enemy.health).toBe(90);
  expect(source.combat!.thorns).toBe(6);
  expect(events.filter((event) => event.kind === "damage").map((event) => event.amount)).toEqual([7, 3]);
});

it("uses actual Leech restoration for Block and feeds existing Burn once", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["mirror-locket", "bellows-heart"];
  source.health -= 8;
  enemy.combat.burn = 3;
  resolveCombat("leechHealth", state, source, 8, events, false, enemy);
  expect(source.block).toBe(2);
  expect(enemy.combat.burn).toBe(4);
  source.health += 4;
  resolveCombat("leechHealth", state, source, 8, events, false, enemy);
  expect(source.block).toBe(2);
  expect(enemy.combat.burn).toBe(4);
});

it("shares a blocked Water hit between Leech, Mirror Locket, Bellows Heart and Reef Diadem", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["mirror-locket", "bellows-heart", "reef-diadem"];
  source.health -= 6;
  const before = source.health;
  source.combat!.thorns = 4;
  enemy.combat.burn = 3;
  enemy.block = 5;
  hit(state, source, enemy, 6, "water", events, { origin: "ability", leech: true });
  expect(source.health).toBe(before + 3);
  expect(source.block).toBe(2);
  expect(enemy.combat.burn).toBe(4);
  expect(enemy.health).toBe(97);
  expect(source.combat!.thorns).toBe(4);
});

it("does not feed Burn when healing restores no Health", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["bellows-heart"];
  enemy.combat.burn = 2;
  restoreHealth(source, 6, events, false, state);
  expect(enemy.combat.burn).toBe(2);
});

it("honors Nullify and reflection on additional Burn and Stun damage", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["bellows-heart", "leafwing-shuttlecock"];
  source.health -= 4;
  enemy.combat.burn = 2;
  enemy.combat.nullify = true;
  restoreHealth(source, 2, events, false, state);
  expect(enemy.combat.burn).toBe(2);
  expect(enemy.combat.nullify).toBe(false);
  enemy.combat.reflect = true;
  hit(state, enemy, source, 2, "physical", events, { origin: "ability", blindMiss: true });
  expect(enemy.health).toBe(98);
  expect(enemy.combat.stun).toBe(0);
  expect(enemy.combat.reflect).toBe(false);
  expect(state.team.some((ally) => ally.combat!.stun === 2)).toBe(true);
});

it("keeps ordinary Stun buildup when the Shuttlecock damage meets Block", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["leafwing-shuttlecock"];
  enemy.block = 4;
  hit(state, enemy, source, 3, "physical", events, { origin: "ability", blindMiss: true });
  expect(enemy.health).toBe(100);
  expect(enemy.block).toBe(2);
  expect(enemy.combat.stun).toBe(2);
});

it("does not bypass Nullify when passing Bleed to another enemy", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = ["harvest-shears"];
  const other = state.battle.enemies[1]!;
  other.combat.nullify = true;
  enemy.health = 1;
  enemy.combat.bleed = 5;
  hit(state, source, enemy, 2, "physical", events);
  expect(other.combat.bleed).toBe(0);
  expect(other.combat.nullify).toBe(false);
});

it("keeps the bonus damage additive when all ten Boons are owned", () => {
  const { state, source, enemy, events } = fixture();
  state.boons = [
    "bellows-heart",
    "leafwing-shuttlecock",
    "soot-brush",
    "echo-ocarina",
    "glassleaf-shield",
    "harvest-shears",
    "frostglass-die",
    "reef-diadem",
    "chromatic-viol",
    "mirror-locket",
  ];
  enemy.combat.poison = 3;
  source.combat!.thorns = 4;
  hit(state, source, enemy, 4, "freeze", events);
  expect(enemy.health).toBe(93);
  expect([enemy.combat.freeze, enemy.combat.burn]).toEqual([5, 2]);
  hit(state, source, enemy, 4, "water", events);
  expect(enemy.health).toBe(84);
  expect(source.combat!.thorns).toBe(4);
});

it("previews and restores a combat state with the new ownership unchanged", () => {
  const state = requireBattle(structuredClone(run()));
  const source = state.team[1]!;
  state.boons = [
    "bellows-heart",
    "leafwing-shuttlecock",
    "soot-brush",
    "echo-ocarina",
    "glassleaf-shield",
    "harvest-shears",
    "frostglass-die",
    "reef-diadem",
    "chromatic-viol",
    "mirror-locket",
  ];
  source.combat!.thorns = 4;
  const card = state.cards.find(
    (entry) => entry.ownerId === source.id && definition(entry.definitionId).effect === "attack",
  )!;
  setBattleCards(state, [card.id]);
  const snapshot = structuredClone(state);
  const command = {
    type: "play",
    cardId: card.id,
    targetId: state.battle.enemies[0]!.id,
    autoEndTurn: false,
  } as const;
  previewCard(state, card.id, state.battle.enemies[0]!.id);
  expect(state).toEqual(snapshot);
  const result = dispatch(state, command);
  expect(result.accepted).toBe(true);
  expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
});
