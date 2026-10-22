import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, cardText, FIRST_RUN_STARTERS, species } from "../../../src/game/content";
import { freshCombat, grantStatus, hit, removeEffects, startAction } from "../../../src/game/combat";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { definitionKeywords, keywordText } from "../../../src/game/keywords";
import { battleChoices } from "../../../src/application/battle-policy";
import { combatStatuses } from "../../../src/ui/shared/combat-status";
import type { GameEvent, GameState } from "../../../src/game/types";
import { accept, teamRun } from "../../support/game";

function ready(copies = 1) {
  return produce(teamRun(1, ["neradora", "mossguard", "prismram"]), (game) => {
    game.discovery.recruited.neradora = copies;
    game.battle!.hand = game.cards.filter((card) => card.ownerId === "ally-0").map((card) => card.id);
    game.battle!.buffer = [];
    game.battle!.discard = [];
    game.battle!.draw = game.cards.filter((card) => card.ownerId !== "ally-0").map((card) => card.id);
    for (const enemy of game.battle!.enemies) enemy.targetId = "ally-1";
    game.team[1]!.block = 1000;
    game.rng = 0;
  });
}
function play(game: GameState, ability: "undertow-knot" | "bloom-shelter" | "tide-cup") {
  return dispatch(game, {
    type: "play",
    cardId: game.cards.find((card) => card.definitionId === `neradora-${ability}`)!.id,
    autoEndTurn: false,
  });
}

it("registers the selected support kit, Water classification, encounters and resumable previews", () => {
  const kit = CARDS.filter((card) => card.species === "neradora");
  expect(kit.map((card) => [card.cost, cardText(card)])).toEqual([
    [1, "Gain 3 Water Thorns"],
    [1, "Restore 2 Health to all allies"],
    [1, "Draw 2 cards; Gain 1 Mana"],
  ]);
  expect(kit.map(definitionKeywords)).toEqual([["water"], ["health"], ["mana"]]);
  expect(FIRST_RUN_STARTERS).not.toContain("neradora");
  expect(COMBAT_PACKS.some((pack) => pack.some((kind) => kind === "neradora"))).toBe(true);
  for (const ability of ["undertow-knot", "bloom-shelter", "tide-cup"] as const) {
    const game = ready();
    const before = encodeSave(game);
    const result = play(game, ability);
    expect(result.accepted).toBe(true);
    expect(
      previewCard(game, game.cards.find((card) => card.definitionId === `neradora-${ability}`)!.id),
    ).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    expect(decodeSave(encodeSave(result.state))).toEqual(result.state);
  }
  expect(() => decodeSave(JSON.stringify({ ...ready(), version: 39 }))).toThrow();
});

it("grants visible Water Thorns to its actor, stacks independently and awards Water XP once", () => {
  const result = play(ready(), "undertow-knot");
  const actor = result.state.team[0]!;
  expect(actor.combat!.waterThorns).toBe(3);
  expect(actor.combat!.thorns).toBe(0);
  expect(actor.block).toBe(0);
  expect(result.state.team.slice(1).every((unit) => unit.combat!.waterThorns === 0)).toBe(true);
  expect(result.state.battleXP.water).toBe(1);
  expect(result.state.battleXP.nature ?? 0).toBe(0);
  expect(result.state.battle!.mana).toBe(3);
  expect(combatStatuses(actor.combat)).toContainEqual(
    expect.objectContaining({ id: "waterThorns", count: 3, text: expect.stringContaining("Water damage") }),
  );
  expect(keywordText("Gain 3 Water Thorns")).toContainEqual({ text: "Water Thorns", keyword: "waterThorns" });
  expect(battleChoices(ready())).toContainEqual(
    expect.objectContaining({ type: "play", cardId: actor.id + ":neradora-undertow-knot" }),
  );
  produce(result.state, (game) => {
    const unit = game.team[0]!;
    grantStatus(unit, "thorns", 2, [], game);
    grantStatus(unit, "waterThorns", 3, [], game);
    expect(unit.combat!.thorns).toBe(2);
    expect(unit.combat!.waterThorns).toBe(6);
    unit.combat!.waterThorns = 999999;
    grantStatus(unit, "waterThorns", 3, [], game);
    expect(unit.combat!.waterThorns).toBe(1000000);
  });
});

it("retaliates as Water through Block and Armor, spends one stack and cannot chain retaliation", () => {
  const events: GameEvent[] = [];
  produce(play(ready(), "undertow-knot").state, (game) => {
    const defender = game.team[0]!;
    const attacker = game.battle!.enemies[0]!;
    defender.combat!.controlled = "freeze";
    attacker.combat.armor = 20;
    attacker.combat.waterThorns = 8;
    attacker.combat.thorns = 8;
    attacker.block = 1;
    const health = attacker.health;
    hit(game, attacker, defender, 1, "water", events);
    expect(attacker.health).toBe(health - 2);
    expect(attacker.block).toBe(0);
    expect(attacker.combat.armor).toBe(19);
    expect(attacker.combat.waterThorns).toBe(8);
    expect(attacker.combat.thorns).toBe(8);
    expect(defender.combat!.waterThorns).toBe(2);
    expect(events.filter((event) => event.kind === "damage" && event.actorId === defender.id)).toEqual([
      expect.objectContaining({ damageType: "water", amount: 2 }),
    ]);
  });
});

it("allows Nature and Water Thorns to retaliate separately on the same hit", () => {
  const events: GameEvent[] = [];
  produce(play(ready(), "undertow-knot").state, (game) => {
    const defender = game.team[0]!;
    defender.combat!.controlled = "freeze";
    defender.combat!.thorns = 2;
    const attacker = game.battle!.enemies[0]!;
    attacker.block = 0;
    attacker.combat = freshCombat();
    hit(game, attacker, defender, 1, "water", events);
    expect(
      events
        .filter((event) => event.kind === "damage" && event.actorId === defender.id)
        .map((event) => [event.damageType, event.amount]),
    ).toEqual([
      ["nature", 2],
      ["water", 3],
    ]);
    expect(defender.combat!.thorns).toBe(1);
    expect(defender.combat!.waterThorns).toBe(2);
  });
});

it.each(["dodge", "block", "periodic", "derived", "retaliation", "knockout"] as const)(
  "does not trigger Water Thorns on %s",
  (kind) => {
    const events: GameEvent[] = [];
    produce(play(ready(), "undertow-knot").state, (game) => {
      const unit = game.team[0]!;
      unit.combat!.controlled = "freeze";
      if (kind === "block") unit.block = 10;
      if (kind === "knockout") {
        unit.health = 1;
        unit.combat!.deathDoorUsed = true;
      }
      hit(game, game.battle!.enemies[0]!, unit, 1, "water", events, {
        blindMiss: kind === "dodge",
        periodic: kind === "periodic",
        derived: kind === "derived",
        retaliation: kind === "retaliation",
      });
      expect(unit.combat!.waterThorns).toBe(3);
      expect(events.some((event) => event.kind === "damage" && event.actorId === unit.id)).toBe(false);
    });
  },
);

it("Purges Water Thorns as its own beneficial category and rejects invalid or missing saved stacks", () => {
  const game = play(ready(), "undertow-knot").state;
  produce(game, (draft) => {
    const unit = draft.team[0]!;
    unit.combat!.thorns = 2;
    removeEffects(unit, "purge", 1, [], draft);
    expect(unit.combat!.thorns).toBe(0);
    expect(unit.combat!.waterThorns).toBe(3);
    removeEffects(unit, "purge", 1, [], draft);
    expect(unit.combat!.waterThorns).toBe(0);
  });
  for (const invalid of [-1, 0.5, 1000001, null, undefined]) {
    const saved = JSON.parse(encodeSave(game));
    saved.team[0].combat.waterThorns = invalid;
    expect(() => decodeSave(JSON.stringify(saved))).toThrow();
  }
});

it("heals all living deployed allies, caps at maximum and excludes backup and knockouts", () => {
  const game = produce(ready(), (draft) => {
    draft.team[0]!.health -= 5;
    draft.team[1]!.health -= 1;
    draft.team[2]!.health = 0;
    draft.reserves.push({ ...draft.team[2]!, id: "backup", health: 1, combat: freshCombat() });
  });
  const result = play(game, "bloom-shelter");
  expect(result.state.team.map((unit) => unit.health)).toEqual([25, species("mossguard").health, 0]);
  expect(result.state.reserves[0]!.health).toBe(1);
  expect(result.state.battleXP.health).toBe(1);
});

it("draws twice then refunds Mana before automatic end turn and grants accepted-play XP once", () => {
  const game = produce(ready(), (draft) => {
    draft.battle!.mana = 1;
  });
  const cardId = game.cards.find((card) => card.definitionId === "neradora-tide-cup")!.id;
  const result = dispatch(game, { type: "play", cardId });
  expect(result.state.battle!.turn).toBe(1);
  expect(result.state.battle!.mana).toBe(1);
  expect(result.state.battle!.hand).toHaveLength(4);
  expect(result.state.battleXP.mana).toBe(1);
  expect(result.state.battle!.cardsPlayedThisTurn).toBe(1);
  expect(result.state.battle!.discard).toEqual([cardId]);
});

it.each([1, 2, 3, 4, 5, 6])(
  "regenerates %i Health on even turns with the same cadence after resume",
  (amount) => {
    let game = produce(ready(amount), (draft) => {
      draft.team[0]!.health = 10;
      draft.team[0]!.block = 1000;
    });
    for (const turn of [2, 3, 4, 5]) {
      game = decodeSave(encodeSave(game));
      game = accept(game, { type: "endTurn" });
      expect(game.battle!.turn).toBe(turn);
      expect(game.team[0]!.health).toBe(10 + Math.floor(turn / 2) * amount);
    }
  },
);

it("keeps regeneration cadence across swaps, skips backup and knockouts, and heals through control", () => {
  produce(ready(6), (game) => {
    const actor = game.team[0]!;
    actor.health = 10;
    actor.combat!.controlled = "freeze";
    actor.combat!.controlTurns = 1;
    expect(startAction(actor, [], game)).toBe(false);
    expect(actor.health).toBe(16);
    game.battle!.turn = 2;
    startAction(actor, [], game);
    expect(actor.health).toBe(16);
    game.reserves.push(game.team.shift()!);
    game.battle!.turn = 3;
    startAction(game.reserves[0]!, [], game);
    expect(game.reserves[0]!.health).toBe(16);
    game.team.unshift(game.reserves.shift()!);
    game.battle!.turn = 4;
    startAction(game.team[0]!, [], game);
    expect(game.team[0]!.health).toBe(16);
    game.battle!.turn = 5;
    startAction(game.team[0]!, [], game);
    expect(game.team[0]!.health).toBe(22);
    game.team[0]!.health = 0;
    startAction(game.team[0]!, [], game);
    expect(game.team[0]!.health).toBe(0);
  });
});

it("runs enemy support on its own side and uses base regeneration independently of collection rank", () => {
  let game = produce(ready(6), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "neradora";
    enemy.name = "Neradora";
    enemy.health = 3;
    enemy.lastAbility = "neradora-bloom-shelter";
  });
  game = accept(game, { type: "endTurn" });
  expect(game.battle!.enemies[0]!.lastAbility).toBe("neradora-undertow-knot");
  expect(game.battle!.enemies[0]!.combat.waterThorns).toBeGreaterThan(0);
  expect(game.team.every((unit) => unit.combat!.waterThorns === 0)).toBe(true);
  const events: GameEvent[] = [];
  produce(game, (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    const before = enemy.health;
    startAction(enemy, events, draft);
    expect(enemy.health).toBe(before + 1);
    expect(events).toContainEqual(expect.objectContaining({ kind: "heal", targetId: enemy.id, amount: 1 }));
  });
  const second = dispatch(game, { type: "endTurn" });
  expect(second.state.battle!.enemies[0]!.lastAbility).toBe("neradora-bloom-shelter");
  expect(
    second.events.filter((event) => event.kind === "heal" && event.targetId?.startsWith("enemy-")).length,
  ).toBeGreaterThan(0);
});

it("retains Water Thorns through rejected commands and swaps without resetting turn cadence", () => {
  const game = produce(play(ready(), "undertow-knot").state, (draft) => {
    draft.roster.push("emberback");
    draft.discovery.recruited.emberback = 1;
    if (!draft.discovery.encountered.includes("emberback")) draft.discovery.encountered.push("emberback");
    draft.reserves.push({
      id: "backup",
      species: "emberback",
      health: 30,
      block: 0,
      attacked: false,
      combat: freshCombat(),
    });
  });
  const rejected = play(game, "undertow-knot");
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(game);
  expect(rejected.state.rng).toBe(game.rng);
  let swapped = accept(game, { type: "swap", activeId: "ally-0", reserve: "backup" });
  swapped = decodeSave(encodeSave(swapped));
  expect(swapped.reserves[0]!.combat!.waterThorns).toBe(3);
  swapped = accept(swapped, { type: "swap", activeId: "backup", reserve: "ally-0" });
  expect(swapped.team[0]!.combat!.waterThorns).toBe(3);
  expect(swapped.battle!.turn).toBe(1);
});

it("caps passive healing without card-only overhealing rewards and resets on a new battle", () => {
  const game = produce(ready(6), (draft) => {
    const actor = draft.team[0]!;
    actor.health = species("neradora").health - 1;
    actor.block = 0;
    draft.talents.push("health.overflow");
    startAction(actor, [], draft);
    expect(actor.health).toBe(species("neradora").health);
    expect(actor.block).toBe(0);
    actor.health = 10;
    actor.combat!.waterThorns = 8;
    draft.phase = "teamSelection";
    draft.battle = null;
  });
  const next = accept(game, { type: "beginBattle" });
  expect(next.battle!.turn).toBe(1);
  expect(next.team[0]!.health).toBe(10);
  expect(next.team[0]!.combat!.waterThorns).toBe(0);
});
