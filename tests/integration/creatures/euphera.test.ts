import { expect, it } from "vitest";
import { produce } from "immer";
import { CARDS, FIRST_RUN_STARTERS, definition, species } from "../../../src/game/content";
import { cardText, enemyCanUse } from "../../../src/game/card-rules";
import { validateContent } from "../../../src/game/content-validation";
import { chance } from "../../../src/game/chance";
import { roll } from "../../../src/game/random";
import { freshCombat, hit } from "../../../src/game/combat";
import { executeAbility } from "../../../src/game/combat/abilities";
import { redrawHand, draw } from "../../../src/game/card-zones";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { swapFromCard } from "../../../src/game/team";
import { COMBAT_PACKS } from "../../../src/game/encounters";
import { battleChoices } from "../../../src/application/battle-policy";
import type { GameEvent, GameState } from "../../../src/game/types";
import { authoredPack, accept, prepareDestination, teamRun, winBattle } from "../../support/game";

function ready(ability = "wish-exchange") {
  return produce(teamRun(1, ["euphera", "mossguard", "prismram"]), (draft) => {
    draft.discovery.recruited.euphera = 6;
    const card = draft.cards.find((card) => card.definitionId === `euphera-${ability}`)!;
    draft.battle!.hand = [card.id];
    draft.battle!.buffer = [];
    draft.battle!.discard = [];
    draft.battle!.draw = draft.cards.filter((other) => other.id !== card.id).map((other) => other.id);
    draft.battle!.enemies.forEach((enemy) => {
      enemy.block = 0;
      enemy.combat = freshCombat();
    });
    draft.rng = 1;
  });
}
function play(game: GameState, targetId?: string) {
  return dispatch(game, { type: "play", cardId: game.battle!.hand[0]!, targetId, autoEndTurn: false });
}
function rolls(seed: number, count: number) {
  const state = { rng: seed } as GameState;
  return Array.from({ length: count }, () => roll(state));
}
function seedFor(predicate: (values: number[]) => boolean) {
  for (let seed = 1; seed < 100000; seed++) if (predicate(rolls(seed, 4))) return seed;
  throw new Error("No matching seeded sequence");
}
function roundTrip(game: GameState) {
  expect(decodeSave(encodeSave(game))).toEqual(game);
}

it("registers exactly the selected kit, six fortune tiers and recruitment", () => {
  expect(() => validateContent()).not.toThrow();
  const cards = CARDS.filter((card) => card.species === "euphera");
  expect(cards.map((card) => [card.cost, cardText(card)])).toEqual([
    [1, "Purge enemy Thorns; Deal 5 Light damage"],
    [1, "Redistribute allied Block evenly; Allies gain 1 Block"],
    [1, "Shuffle your hand into your deck; Draw that many cards"],
  ]);
  expect(cards.map(enemyCanUse)).toEqual([true, true, false]);
  expect(species("euphera").passiveTiers.map((tier) => tier.effects)).toEqual(
    [10, 20, 30, 40, 50, 60].map((amount) => [{ kind: "goodFortune", amount }]),
  );
  expect(FIRST_RUN_STARTERS).toContain("euphera");
  let game = produce(ready(), (draft) => {
    prepareDestination(draft);
    draft.expedition = {
      recruit: null,
      lastRoom: null,
      pack: authoredPack(
        draft.encounter,
        COMBAT_PACKS.findIndex((pack) => pack[0] === "euphera"),
      ),
    };
  });
  game = accept(game, { type: "beginBattle" });
  expect(game.discovery.encountered).toContain("euphera");
  game = accept(winBattle(game), { type: "recruit", species: "euphera" });
  roundTrip(game);
});

it.each(["twilight-lance", "wish-exchange", "possible-path"])(
  "%s retains preview, rejection and resume contracts",
  (ability) => {
    const game = ready(ability);
    const before = encodeSave(game);
    const target = ability === "twilight-lance" ? "enemy-0" : undefined;
    const result = play(game, target);
    expect(result.accepted).toBe(true);
    expect(previewCard(game, game.battle!.hand[0]!, target)).toEqual(result);
    expect(encodeSave(game)).toBe(before);
    roundTrip(result.state);
    const denied = produce(game, (draft) => {
      draft.battle!.mana = 0;
    });
    expect(play(denied, target)).toMatchObject({ accepted: false, state: denied, events: [] });
    expect(play(denied, target).state).toBe(denied);
    expect(
      battleChoices(game, false).every(
        (choice) =>
          choice.type !== "play" ||
          choice.cardId !== game.battle!.hand[0] ||
          (ability === "twilight-lance"
            ? game.battle!.enemies.some((enemy) => enemy.id === choice.targetId)
            : choice.targetId === undefined),
      ),
    ).toBe(true);
  },
);

it("purges both Thorns pools before the chosen enemy can retaliate, retaining other effects", () => {
  const game = produce(ready("twilight-lance"), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    Object.assign(enemy.combat, {
      thorns: 50,
      waterThorns: 50,
      armor: 4,
      nullify: true,
      poison: 2,
      controlled: "freeze",
      controlTurns: 1,
    });
    draft.rng = seedFor(([first]) => first! > 0.05);
  });
  const result = play(game, "enemy-0");
  expect(result.state.team[0]!.health).toBe(game.team[0]!.health);
  expect(result.state.battle!.enemies[0]!.combat).toMatchObject({
    thorns: 0,
    waterThorns: 0,
    armor: 3,
    nullify: true,
    poison: 2,
  });
  expect(
    result.events.filter((event): event is Extract<GameEvent, { kind: "damage" }> => event.kind === "damage"),
  ).toEqual([expect.objectContaining({ targetId: "enemy-0", damageType: "light", amount: 5 })]);
  expect(
    result.events.findIndex((event) => event.kind === "status" && event.status === "purge"),
  ).toBeLessThan(result.events.findIndex((event) => event.kind === "damage"));
});

it("purges on a missed Lance without removing other enemies' Thorns", () => {
  const game = produce(ready("twilight-lance"), (draft) => {
    draft.team[0]!.combat!.blind = true;
    draft.rng = 1;
    draft.discovery.recruited.euphera = 1;
    draft.battle!.enemies.forEach((enemy) => {
      enemy.combat.thorns = 6;
    });
  });
  const result = play(game, "enemy-0");
  expect(result.state.battle!.enemies.map((enemy) => enemy.combat.thorns)).toEqual([0, 6, 6]);
  expect(result.events.some((event) => event.kind === "damage")).toBe(false);
});

it("redistributes a fixed Block total with a stable remainder, then grants Block", () => {
  const game = produce(ready(), (draft) => {
    draft.team.forEach((unit, i) => {
      unit.block = [8, 0, 0][i]!;
    });
  });
  const result = play(game);
  expect(result.state.team.map((unit) => unit.block)).toEqual([4, 4, 3]);
  expect(result.events.some((event) => event.kind === "block" && (event.amount ?? 0) < 0)).toBe(false);
  expect(result.state.battleXP.block).toBe(1);
  expect(battleChoices(game, false)).toContainEqual({
    type: "play",
    cardId: game.battle!.hand[0],
    autoEndTurn: false,
  });
});

it("does not treat moved Block as a fresh gain or include knocked-out allies", () => {
  const game = produce(teamRun(1, ["euphera", "bloomquail", "reedstag"]), (draft) => {
    draft.team[0]!.block = 10;
    draft.team[1]!.health -= 10;
    draft.team[2]!.health = 0;
    draft.team[2]!.block = 99;
    const card = draft.cards.find((card) => card.definitionId === "euphera-wish-exchange")!;
    draft.battle!.hand = [card.id];
    draft.battle!.buffer = [];
    draft.battle!.draw = draft.cards.filter((entry) => entry.id !== card.id).map((entry) => entry.id);
    draft.battle!.discard = [];
  });
  const result = play(game);
  expect(result.state.team.map((unit) => unit.block)).toEqual([6, 5, 99]);
  expect(result.state.team[1]!.health).toBe(game.team[1]!.health + 1);
});

it("redraws the remaining hand with unchanged card identities and upgrades", () => {
  const game = produce(ready("possible-path"), (draft) => {
    const rest = draft.battle!.draw.splice(-3);
    draft.battle!.hand.push(...rest);
    draft.cards.find((card) => card.id === rest[0])!.level = 2;
  });
  const result = play(game);
  expect(result.state.battle!.hand).toHaveLength(3);
  expect(result.state.cards).toEqual(game.cards);
  const zones = [
    result.state.battle!.hand,
    result.state.battle!.buffer,
    result.state.battle!.draw,
    result.state.battle!.discard,
  ].flat();
  expect(new Set(zones).size).toBe(game.cards.length);
  expect(zones).toHaveLength(game.cards.length);
  expect(result.state.battle!.discard).toContain(game.battle!.hand[0]);
  expect(battleChoices(game, false)).toContainEqual({
    type: "play",
    cardId: game.battle!.hand[0],
    autoEndTurn: false,
  });
});

it("leaves an empty hand and RNG alone; retains hidden overflow in FIFO order", () => {
  const game = produce(ready("possible-path"), (draft) => {
    const events: GameEvent[] = [];
    draft.battle!.hand = [];
    const before = draft.rng;
    redrawHand(draft, events);
    expect(draft.rng).toBe(before);
    const ids = draft.cards.map((card) => card.id);
    draft.battle!.hand = ids.slice(0, 2);
    draft.battle!.buffer = ids.slice(2, 5);
    draft.battle!.draw = ids.slice(5);
    draft.battle!.discard = [];
    redrawHand(draft, events);
    expect(draft.battle!.hand.slice(0, 3)).toEqual(ids.slice(2, 5));
    expect(draft.battle!.hand).toHaveLength(5);
  });
  roundTrip(game);
});

it("routes actual critical hits through a single Good Fortune retry", () => {
  const seed = seedFor(([a, b, c]) => a! >= 0.05 && b! < 0.6 && c! < 0.05);
  const game = produce(ready(), (draft) => {
    draft.rng = seed;
    const enemy = draft.battle!.enemies[0]!;
    enemy.combat.controlled = "freeze";
    enemy.combat.controlTurns = 1;
    const events: GameEvent[] = [];
    hit(draft, draft.team[1]!, enemy, 5, "light", events);
    expect(events).toContainEqual(expect.objectContaining({ kind: "damage", critical: true, amount: 10 }));
    expect(events.filter((event) => event.text === "Good Fortune turns the odds")).toHaveLength(1);
  });
  roundTrip(game);
});

it("retries a failed effect at its original chance, with no recursive gate", () => {
  const seed = seedFor(([a, b, c]) => a! >= 0.1 && b! < 0.6 && c! >= 0.1);
  produce(ready(), (draft) => {
    draft.rng = seed;
    expect(chance(draft, 0.1, false, [])).toBe(false);
    const expected = { rng: seed } as GameState;
    for (let i = 0; i < 3; i++) roll(expected);
    expect(draft.rng).toBe(expected.rng);
  });
});

it("does not spend extra RNG for success, impossible effects, or inactive/opposing providers", () => {
  for (const inactive of ["knockout", "backup", "opposing"] as const) {
    produce(ready(), (draft) => {
      if (inactive === "knockout") draft.team[0]!.health = 0;
      if (inactive === "backup") draft.reserves.push(draft.team.shift()!);
      draft.rng = 1;
      expect(chance(draft, 0.1, inactive === "opposing", [])).toBe(false);
      const expected = { rng: 1 } as GameState;
      roll(expected);
      expect(draft.rng).toBe(expected.rng);
    });
  }
  produce(ready(), (draft) => {
    const before = draft.rng;
    expect(chance(draft, 0, false, [])).toBe(false);
    expect(chance(draft, 1, false, [])).toBe(true);
    expect(draft.rng).toBe(before);
    expect(chance(draft, 0.5, false, [])).toBe(true);
    const expected = { rng: before } as GameState;
    roll(expected);
    expect(draft.rng).toBe(expected.rng);
  });
});

it("Good Fortune also retries allied passive draws and does not recursively copy", () => {
  const seed = seedFor(([a, b, c]) => a! >= 0.2 && b! < 0.6 && c! < 0.2);
  produce(teamRun(1, ["euphera", "rookhaven", "mossguard"]), (draft) => {
    draft.discovery.recruited.euphera = 6;
    draft.rng = seed;
    const before = draft.cards.length;
    draw(draft, 1, []);
    expect(draft.cards).toHaveLength(before + 1);
  });
});

it("enemies redistribute their own Block and purge allied Thorns before attacking", () => {
  produce(ready(), (draft) => {
    const enemy = draft.battle!.enemies[0]!;
    enemy.species = "euphera";
    draft.battle!.enemies.forEach((unit, i) => {
      unit.block = [7, 0, 0][i]!;
    });
    executeAbility(
      draft as Extract<GameState, { phase: "battle" }>,
      { side: "enemy", actor: enemy, def: definition("euphera-wish-exchange"), value: 1 },
      [],
      { swap: swapFromCard },
    );
    expect(draft.battle!.enemies.map((unit) => unit.block)).toEqual([4, 3, 3]);
    draft.team[1]!.combat!.thorns = 30;
    draft.team[1]!.combat!.waterThorns = 20;
    executeAbility(
      draft as Extract<GameState, { phase: "battle" }>,
      {
        side: "enemy",
        actor: enemy,
        def: definition("euphera-twilight-lance"),
        value: 5,
        targetId: "ally-1",
      },
      [],
      { swap: swapFromCard },
    );
    expect(draft.team[1]!.combat).toMatchObject({ thorns: 0, waterThorns: 0 });
  });
});

it("uses the strongest provider once and re-evaluates after a swap", () => {
  const seed = seedFor(([a, b, c]) => a! >= 0.1 && b! < 0.6 && c! >= 0.1);
  produce(teamRun(1, ["euphera", "euphera", "mossguard"]), (draft) => {
    draft.discovery.recruited.euphera = 6;
    draft.rng = seed;
    expect(chance(draft, 0.1, false, [])).toBe(false);
    const expected = { rng: seed } as GameState;
    for (let i = 0; i < 3; i++) roll(expected);
    expect(draft.rng).toBe(expected.rng);
    draft.reserves.push(...draft.team.splice(0, 2));
    draft.rng = seed;
    expect(chance(draft, 0.1, false, [])).toBe(false);
    expected.rng = seed;
    roll(expected);
    expect(draft.rng).toBe(expected.rng);
  });
});

it("grants enemy allies only the base tier and leaves the player's rolls alone", () => {
  const seed = seedFor(([a, b, c]) => a! >= 0.1 && b! < 0.1 && c! < 0.1);
  produce(ready(), (draft) => {
    draft.battle!.enemies[0]!.species = "euphera";
    draft.team[0]!.health = 0;
    draft.rng = seed;
    expect(chance(draft, 0.1, true, [])).toBe(true);
    draft.rng = seed;
    expect(chance(draft, 0.1, false, [])).toBe(false);
  });
});
