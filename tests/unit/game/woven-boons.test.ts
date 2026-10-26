import { expect, it } from "vitest";
import { run, requireBattle, teamRun, addReserve } from "../../support/game";
import { setBattleCards, cardId } from "../../support/cards";
import { NEW_BOON_EFFECTS } from "../../support/boons";
import { BOONS, definition, species } from "../../../src/game/content";
import { freshCombat, hit, removeEffects, restoreHealth, tickStatuses } from "../../../src/game/combat/index";
import { swapBackup } from "../../../src/game/team";
import { createTemporaryCard } from "../../../src/game/card-zones";
import { summonEcho } from "../../../src/game/combat/legendary";
import { useFood } from "../../../src/game/combat/food";
import { observeDecisions } from "../../../src/game/random";
import { dispatch, previewCard } from "../../../src/game/engine";
import { encodeSave, decodeSave } from "../../../src/game/save";
import { cardTargeting, cardText } from "../../../src/game/card-rules";
import { availablePlays } from "../../../src/game/play-queries";
import { rankedBattleChoices } from "../../../src/application/battle-policy";
import prepared from "../../../src/assets/prepared.json";
import type { GameEvent } from "../../../src/game/types";

const ids = [
  "hoard-lockplate",
  "rootvault-pole",
  "star-hoop",
  "pattern-reel",
  "prayer-sailboat",
  "pumpkin-tureen",
  "field-lunch-basket",
  "winnowing-sieve",
  "blooming-still",
  "yarrow-salve-tin",
] as const;
function fixture() {
  const state = requireBattle(structuredClone(run()));
  state.talents = [];
  state.boons = [];
  for (const unit of [...state.team, ...state.battle.enemies]) {
    unit.block = 0;
    unit.combat = freshCombat();
  }
  observeDecisions(state, () => 0.99);
  return { state, ally: state.team[0]!, enemy: state.battle.enemies[0]!, events: [] as GameEvent[] };
}
function foodFixture(id: string) {
  const f = fixture();
  const card = createTemporaryCard(f.state, { definitionId: id, ownerId: null, level: 0 })!;
  setBattleCards(f.state, [card.id]);
  return { ...f, card, def: definition(id) };
}

it.each(ids)("%s registers its approved rule, portrait and current-format ownership", (id) => {
  const state = requireBattle(structuredClone(run()));
  state.boons = [id];
  expect(BOONS.find((boon) => boon.id === id)?.text).toBe(NEW_BOON_EFFECTS[id]);
  expect(Object.hasOwn(prepared.records, "boon." + id)).toBe(true);
  expect(decodeSave(encodeSave(state)).boons).toEqual([id]);
});

it.each(["physical", "stun"] as const)(
  "Hoard Lockplate protects allied Block from %s without changing the default order",
  (type) => {
    for (const owned of [false, true]) {
      const { state, ally, enemy, events } = fixture();
      if (owned) state.boons = ["hoard-lockplate"];
      ally.block = 10;
      ally.combat!.armor = 5;
      hit(state, enemy, ally, 8, type, events, { origin: "proc" });
      expect(ally.block).toBe(owned ? 7 : 2);
      expect(ally.health).toBe(species(ally.species).health);
      expect(ally.combat!.armor).toBe(4);
      if (type === "stun") expect(ally.combat!.stun).toBe(3);
      enemy.block = 10;
      enemy.combat.armor = 5;
      hit(state, ally, enemy, 8, type, events, { origin: "proc" });
      expect(enemy.block).toBe(2);
    }
  },
);
it("Hoard Lockplate respects Armor applicability, wards, wear and Leech through Block", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["hoard-lockplate"];
  ally.block = 10;
  ally.combat!.armor = 5;
  hit(state, enemy, ally, 8, "water", events, { origin: "proc" });
  expect(ally.block).toBe(2);
  ally.block = 10;
  ally.combat!.armor = 5;
  state.talents = ["armor.fireward"];
  hit(state, enemy, ally, 8, "burn", events, { origin: "proc", leech: true });
  expect([ally.block, ally.combat!.burn, ally.combat!.armor]).toEqual([7, 3, 4]);
  ally.combat!.negate = true;
  hit(state, enemy, ally, 8, "physical", events);
  expect(ally.block).toBe(7);
});
it.each(["thorns", "waterThorns", "fireThorns"] as const)(
  "Rootvault Pole Dodges %s with ordinary rewards and no retaliation chain",
  (status) => {
    const { state, ally, enemy, events } = fixture();
    state.boons = ["rootvault-pole", "briar-racquet"];
    state.talents = ["block.footwork"];
    ally.combat!.thorns = 8;
    enemy.combat.controlled = "freeze";
    enemy.combat.controlTurns = 1;
    enemy.combat[status] = 5;
    observeDecisions(state, () => 0);
    hit(state, ally, enemy, 1, "water", events);
    expect(enemy.combat[status]).toBe(4);
    expect(ally.health).toBe(species(ally.species).health);
    expect(ally.combat!.burn).toBe(0);
    expect(ally.combat!.thorns).toBe(8);
    expect(ally.block).toBe(2);
    expect(events.filter((e) => e.kind === "status" && e.outcome === "dodge")).toHaveLength(1);
  },
);
it("Rootvault Pole preserves control suppression and cannot Dodge unrelated retaliation", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["rootvault-pole"];
  ally.combat!.controlled = "stun";
  ally.combat!.controlTurns = 1;
  observeDecisions(state, () => 0);
  hit(state, enemy, ally, 3, "nature", events, { origin: "retaliation", thorns: true });
  expect(ally.health).toBe(species(ally.species).health - 3);
  ally.combat!.controlled = null;
  hit(state, enemy, ally, 2, "water", events, { origin: "retaliation" });
  expect(ally.health).toBe(species(ally.species).health - 5);
});
it("Star Hoop returns an entire enemy Purge to its attacker and spends Reflect once", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["star-hoop"];
  enemy.species = "mossguard";
  ally.combat!.reflect = true;
  ally.combat!.armor = 4;
  enemy.block = 5;
  enemy.combat.armor = 3;
  enemy.combat.reflect = true;
  removeEffects(ally, "purge", 2, events, state, undefined, enemy);
  expect(ally.combat!.armor).toBe(4);
  expect(ally.combat!.reflect).toBe(false);
  expect([enemy.block, enemy.combat.armor, enemy.combat.reflect]).toEqual([0, 0, true]);
  expect(events.filter((e) => e.kind === "status" && e.status === "reflect")).toHaveLength(1);
});
it("Star Hoop uses innate Reflect, preserves ineligible charges and lets Nullify protection precede reflection", () => {
  const { state, enemy, events } = fixture();
  const ally = state.team[2]!;
  state.boons = ["star-hoop"];
  ally.combat!.armor = 3;
  enemy.block = 3;
  observeDecisions(state, () => 0);
  removeEffects(ally, "purge", 1, events, state, "armor", enemy);
  expect([ally.combat!.armor, enemy.combat.armor]).toEqual([3, 0]);
  ally.combat!.reflect = true;
  removeEffects(ally, "purge", 1, events, state, "fireThorns", enemy);
  expect(ally.combat!.reflect).toBe(true);
  state.boons.push("coronation-cloche");
  ally.combat!.nullify = true;
  removeEffects(ally, "purge", 2, events, state, undefined, enemy);
  expect(ally.combat!.reflect).toBe(true);
  expect(ally.combat!.armor).toBe(3);
});
it("Pattern Reel removes matching Armor behind other enemies' Block with ordinary Purge rewards", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["pattern-reel", "prism-chisel"];
  const other = state.battle.enemies[1]!;
  enemy.combat.armor = 3;
  other.combat.armor = 4;
  other.block = 10;
  removeEffects(enemy, "purge", 1, events, state, undefined, ally);
  expect([enemy.combat.armor, other.combat.armor, other.block]).toEqual([0, 0, 6]);
  expect(
    events.filter((e) => e.kind === "status" && e.status === "purge" && e.affectedStatus === "armor"),
  ).toHaveLength(2);
});
it("Pattern Reel distinguishes typed reflection wards that share feedback labels", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["pattern-reel"];
  const other = state.battle.enemies[1]!;
  enemy.combat.reflectBurn = true;
  other.combat.reflect = true;
  other.combat.reflectBurn = true;
  removeEffects(enemy, "purge", 1, events, state, "reflectBurn", ally);
  expect(other.combat.reflectBurn).toBe(false);
  expect(other.combat.reflect).toBe(true);
});
it("Winnowing Sieve carries only unused removal through distinct enemy effects", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["winnowing-sieve"];
  const second = state.battle.enemies[1]!,
    third = state.battle.enemies[2]!;
  second.block = 2;
  third.combat.armor = 3;
  third.combat.thorns = 4;
  removeEffects(enemy, "purge", 2, events, state, undefined, ally);
  expect([second.block, third.combat.armor, third.combat.thorns]).toEqual([0, 0, 4]);
});
it("Winnowing Sieve composes with Pattern Reel and Pearl Sieve without spending free Block removal", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["winnowing-sieve", "pattern-reel", "pearl-sieve"];
  const second = state.battle.enemies[1]!,
    third = state.battle.enemies[2]!;
  second.block = 2;
  second.combat.armor = 3;
  third.combat.thorns = 4;
  removeEffects(enemy, "purge", 2, events, state, undefined, ally);
  expect([second.block, second.combat.armor, third.combat.thorns]).toEqual([0, 0, 0]);
  expect(events.length).toBeLessThan(20);
});
it("Prayer Sailboat Cleanses departing control and buildup without rotating immunity on a clear swap", () => {
  const { state, ally, events } = fixture();
  state.boons = ["prayer-sailboat"];
  addReserve(state, "backup", "dunefox", species("dunefox").health, freshCombat());
  ally.combat!.controlled = "stun";
  ally.combat!.controlTurns = 1;
  ally.combat!.freeze = 5;
  swapBackup(state, ally.id, "backup", events, true);
  expect(state.reserves.find((u) => u.id === ally.id)?.combat).toMatchObject({
    controlled: null,
    stun: 0,
    freeze: 0,
    cooldown: 3,
  });
  const incoming = state.team[0]!;
  incoming.combat!.cooldown = 1;
  swapBackup(state, incoming.id, ally.id, events, true);
  expect(incoming.combat!.cooldown).toBe(1);
});
it("Prayer Sailboat does not Cleanse ordinary knockout replacement", () => {
  const { state, ally, events } = fixture();
  state.boons = ["prayer-sailboat"];
  addReserve(state, "backup", "dunefox", species("dunefox").health, freshCombat());
  ally.health = 0;
  ally.combat!.freeze = 5;
  swapBackup(state, ally.id, "backup", events);
  expect(ally.combat!.freeze).toBe(5);
});
it.each(["food-apple", "food-trail-bread"])(
  "Pumpkin Tureen makes %s automatic and matches preview, command and resume",
  (id) => {
    const { state, card, def } = foodFixture(id);
    state.boons = ["pumpkin-tureen", "field-lunch-basket"];
    for (const ally of state.team) ally.health -= 8;
    const original = encodeSave(state);
    expect(cardTargeting(def, state)).toBe("automatic");
    expect(cardText(def, 0, 6, 1, state)).toContain("all allies");
    expect(availablePlays(state, false).find((p) => p.card.id === card.id)?.commands).toHaveLength(1);
    const choice = rankedBattleChoices(state, false).find(
      (p) => p.command.type === "play" && p.command.cardId === card.id,
    );
    expect(choice).toBeDefined();
    const preview = previewCard(state, card.id);
    expect(encodeSave(state)).toBe(original);
    const result = dispatch(state, { type: "play", cardId: card.id, autoEndTurn: false });
    expect(result.accepted).toBe(true);
    for (let i = 0; i < state.team.length; i++) {
      const after = result.state.team[i]!;
      if (id === "food-apple") expect(after.health).toBe(state.team[i]!.health + 6);
      else expect(after.block).toBe(6);
    }
    expect(result.state.cards.some((c) => c.id === card.id)).toBe(false);
    expect(result.state.battle!.draw.length).toBe(state.battle.draw.length - 1);
    expect(preview.state.team).toEqual(result.state.team);
    expect(decodeSave(encodeSave(result.state)).team).toEqual(result.state.team);
  },
);
it("Food repeats restore shared Mana twice but draw only once per consumed play", () => {
  const { state, card } = foodFixture("food-mana-berries");
  state.boons = ["pumpkin-tureen", "field-lunch-basket"];
  state.battle.mana = 1;
  state.battle.repeatNext.player = true;
  const result = dispatch(state, { type: "play", cardId: card.id, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.battle?.mana).toBe(4);
  expect(result.state.battle!.draw.length).toBe(state.battle.draw.length - 1);
});
it("Group Food reaches live Minions and Camp Hammock backups, with two heals but one draw on repeat", () => {
  const { state, ally, events } = fixture();
  state.boons = ["pumpkin-tureen", "field-lunch-basket", "camp-hammock"];
  addReserve(state, "backup", "dunefox", 1, freshCombat());
  summonEcho(state, ally, "player", 20, events);
  const echo = state.battle.minions![0]!;
  echo.health = 1;
  for (const unit of state.team) unit.health = 1;
  state.battle.repeatNext.player = true;
  const before = state.battle.draw.length;
  useFood(state, definition("food-apple"), undefined, events);
  expect(echo.health).toBe(13);
  expect(state.reserves[0]!.health).toBe(13);
  expect(state.team.every((unit) => unit.health === 13)).toBe(true);
  expect(state.battle.draw.length).toBe(before - 1);
  ally.health = 0;
  echo.block = 0;
  useFood(state, definition("food-trail-bread"), undefined, events);
  expect(echo.block).toBe(0);
});
it("Pumpkin Tureen keeps individual targeting without ownership and rejection keeps the save and RNG", () => {
  const { state, card, def } = foodFixture("food-apple");
  expect(cardTargeting(def, state)).toBe("ally");
  const before = encodeSave(state);
  const result = dispatch(state, { type: "play", cardId: card.id, autoEndTurn: false });
  expect(result.accepted).toBe(false);
  expect(encodeSave(result.state)).toBe(before);
});
it("Blooming Still rewards actual full and partial Poison Cleanse, not natural decay or Purge", () => {
  const { state, ally, events } = fixture();
  state.boons = ["blooming-still"];
  state.battle.mana = 0;
  ally.combat!.poison = 6;
  removeEffects(ally, "cleanse", 1, events, state, "poison");
  expect(state.battle.mana).toBe(1);
  removeEffects(ally, "cleanse", 1, events, state, "poison");
  expect(state.battle.mana).toBe(1);
  ally.combat!.poison = 6;
  tickStatuses(state, ally, events);
  expect(state.battle.mana).toBe(1);
  state.boons.push("plague-doctors-mask");
  tickStatuses(state, ally, events);
  expect(state.battle.mana).toBe(2);
  expect(ally.combat!.poison).toBeGreaterThan(0);
});
it("Yarrow Salve Tin Cleanses Bleed and deferred Leech only on actual healing", () => {
  const { state, ally, enemy, events } = fixture();
  state.boons = ["yarrow-salve-tin"];
  ally.combat!.bleed = 6;
  ally.combat!.bleedLeech = [{ sourceId: enemy.id, amount: 6 }];
  restoreHealth(ally, 1, events, false, state);
  expect(ally.combat!.bleed).toBe(6);
  ally.health -= 2;
  ally.combat!.burn = 3;
  restoreHealth(ally, 1, events, false, state);
  expect([ally.combat!.bleed, ally.combat!.burn]).toEqual([0, 3]);
  expect(ally.combat!.bleedLeech).toEqual([]);
});
it("Healing, group Cleanse, Poison Mana and Mana healing settle without a reward loop", () => {
  const { state, ally, events } = fixture();
  state.boons = ["yarrow-salve-tin", "blooming-still", "miracle-megaphone", "sin-eaters-lantern"];
  state.talents = ["mana.arcane-mending"];
  state.battle.mana = 0;
  for (const unit of state.team) {
    unit.health -= 8;
    unit.combat!.bleed = 3;
    unit.combat!.poison = 2;
  }
  removeEffects(ally, "cleanse", 1, events, state, "poison");
  expect(state.battle.mana).toBe(3);
  expect(state.team.every((u) => u.combat!.bleed === 0 && u.combat!.poison === 0)).toBe(true);
  expect(events.length).toBeLessThan(80);
});
it("Prayer Sailboat works through controlled swap admission and preserves preview state", () => {
  const state = requireBattle(structuredClone(teamRun(42, ["captoad", "mossguard", "emberback"])));
  state.boons = ["prayer-sailboat", "accordioned-bridge"];
  addReserve(state, "backup", "dunefox", species("dunefox").health, freshCombat());
  state.team[0]!.combat!.controlled = "freeze";
  state.team[0]!.combat!.controlTurns = 1;
  const id = cardId(state, "captoad-swap");
  setBattleCards(state, [id]);
  const before = encodeSave(state);
  previewCard(state, id);
  expect(encodeSave(state)).toBe(before);
  const result = dispatch(state, { type: "play", cardId: id, autoEndTurn: false });
  expect(result.accepted).toBe(true);
  expect(result.state.reserves.find((u) => u.id === "ally-0")?.combat!.controlled).toBeNull();
});
