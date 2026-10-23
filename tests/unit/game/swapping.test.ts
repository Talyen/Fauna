import { freshCombat, ensureCombat } from "../../../src/game/combat/index";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { CARDS, species } from "../../../src/game/content";
import { pendingReplacement } from "../../../src/game/team";
import { chooseBattleCommand } from "../../../src/application/battle-policy";
import { completeRecruitment, accept, run, winBattle, swapFixture } from "../../support/game";

function withReserves() {
  return produce(run(), (d) => {
    for (const kind of ["pollenmoth", "emberback"] as const) {
      d.reserves.push({
        id: `recruit-${kind}`,
        species: kind,
        health: species(kind).health,
        block: 0,
        combat: freshCombat(),
        attacked: false,
      });
    }
  });
}

describe("knockout replacements", () => {
  it("rejects free swaps of healthy or controlled allies and removed lineup commands without changing RNG", () => {
    const game = produce(withReserves(), (d) => {
      d.team[0]!.combat!.controlled = "freeze";
    });
    for (const command of [
      { type: "swap", activeId: "ally-0", reserve: "recruit-pollenmoth" },
      { type: "swap", activeId: "", reserve: "recruit-pollenmoth" },
      { type: "setLineup", activeId: "ally-0", reserve: "recruit-pollenmoth" },
    ]) {
      const result = dispatch(game, command as never);
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(game);
      expect(result.events).toEqual([]);
    }
    expect(chooseBattleCommand(game).type).not.toBe("swap");
  });
  it("requires a living backup for the first knockout before cards or End turn, including after resume", () => {
    const game = produce(withReserves(), (d) => {
      d.team[0]!.health = 0;
      d.team[1]!.health = 0;
      d.reserves[1]!.health = 0;
    });
    const restored = decodeSave(encodeSave(game));
    expect(pendingReplacement(restored)?.id).toBe("ally-0");
    for (const command of [
      { type: "play", cardId: restored.battle!.hand[0] },
      { type: "endTurn" },
      { type: "swap", activeId: "ally-1", reserve: "recruit-pollenmoth" },
      { type: "swap", activeId: "ally-0", reserve: "recruit-emberback" },
    ])
      expect(dispatch(restored, command as never).state).toBe(restored);
    const next = accept(restored, { type: "swap", activeId: "ally-0", reserve: "recruit-pollenmoth" });
    expect(pendingReplacement(next)).toBeUndefined();
    expect(next.battle!.mana).toBe(restored.battle!.mana);
    expect(next.battle!.turn).toBe(restored.battle!.turn);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it("keeps spent card slots, hand/overflow order, effects and enemy target references on replacement", () => {
    const game = produce(withReserves(), (d) => {
      d.team[0]!.health = 0;
      d.team[0]!.combat!.poison = 4;
      const ids = d.cards.map((c) => c.id);
      d.battle!.hand = ids.slice(0, 6);
      d.battle!.buffer = ids.slice(6, 7);
      d.battle!.draw = ids.slice(7, 8);
      d.battle!.discard = ids.slice(8);
      d.battle!.enemies[0]!.targetId = "ally-0";
    });
    const next = accept(game, { type: "swap", activeId: "ally-0", reserve: "recruit-pollenmoth" });
    for (const zone of ["hand", "buffer", "draw", "discard"] as const)
      expect(next.battle![zone]).toEqual(game.battle![zone]);
    expect(next.rng).toBe(game.rng);
    expect(next.battle!.enemies[0]!.targetId).toBe("recruit-pollenmoth");
    expect(next.reserves.find((c) => c.id === "ally-0")!.combat!.poison).toBe(4);
    expect(next.cards.filter((c) => c.ownerId === "recruit-pollenmoth").map((c) => c.definitionId)).toEqual(
      CARDS.filter((c) => c.species === "pollenmoth").map((c) => c.id),
    );
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it("allows a controlled living backup when it is the only survivor, with no repeated opening grants", () => {
    const game = produce(withReserves(), (d) => {
      d.team.forEach((c) => (c.health = 0));
      d.reserves[0]!.combat!.controlled = "freeze";
      d.reserves[0]!.combat!.controlTurns = 1;
      d.reserves[0]!.combat!.freeze = 10;
      d.reserves[1]!.health = 0;
    });
    const command = chooseBattleCommand(game);
    expect(command).toEqual({ type: "swap", activeId: "ally-0", reserve: "recruit-pollenmoth" });
    const next = accept(game, command);
    expect(next.team[0]!.combat!.controlled).toBe("freeze");
    expect(next.team[0]!.block).toBe(0);
    expect(pendingReplacement(next)).toBeUndefined();
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it("keeps repeated replacement choices pending until the available backups are deployed", () => {
    let game = produce(withReserves(), (d) => d.team.forEach((c) => (c.health = 0)));
    for (const reserve of ["recruit-pollenmoth", "recruit-emberback"]) {
      game = accept(game, { type: "swap", activeId: pendingReplacement(game)!.id, reserve });
      expect(decodeSave(encodeSave(game))).toEqual(game);
    }
    expect(pendingReplacement(game)).toBeUndefined();
    expect(game.team.filter((c) => c.health > 0)).toHaveLength(2);
  });
  it("resumes automatic End turn after the final zero-Mana replacement and respects its opt-out", () => {
    const game = produce(withReserves(), (d) => {
      d.team[0]!.health = 0;
      d.battle!.mana = 0;
    });
    const manual = accept(game, {
      type: "swap",
      activeId: "ally-0",
      reserve: "recruit-pollenmoth",
      autoEndTurn: false,
    });
    expect(manual.battle!.turn).toBe(game.battle!.turn);
    const auto = accept(game, { type: "swap", activeId: "ally-0", reserve: "recruit-pollenmoth" });
    expect(auto.battle!.turn).toBeGreaterThan(game.battle!.turn);
  });
  it("does not interrupt committed enemy/status resolution, then requires recovery before another turn", () => {
    let game = produce(withReserves(), (d) => {
      for (const ally of d.team) {
        ally.health = 1;
        ensureCombat(ally).deathDoorUsed = true;
        ensureCombat(ally).poison = 2;
      }
    });
    game = accept(game, { type: "endTurn" });
    expect(game.phase).toBe("battle");
    expect(game.team.every((c) => c.health === 0)).toBe(true);
    expect(pendingReplacement(game)).toBeDefined();
    expect(dispatch(game, { type: "endTurn" }).state).toBe(game);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });
  it("never resets first-attack/once-per-battle effects or repeats opening grants when a mechanic cycles creatures", () => {
    let game = produce(withReserves(), (d) => {
      d.team[1]!.attacked = true;
      d.team[1]!.block = 5;
      ensureCombat(d.team[1]!).deathDoorUsed = true;
    });
    for (let i = 0; i < 5; i++) {
      game = swapFixture(game, { type: "swap", activeId: game.team[1]!.id, reserve: "recruit-pollenmoth" });
      game = swapFixture(game, { type: "swap", activeId: game.team[1]!.id, reserve: "ally-1" });
    }
    expect(game.team[1]!.attacked).toBe(true);
    expect(game.team[1]!.block).toBe(5);
    expect(game.team[1]!.combat!.deathDoorUsed).toBe(true);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });
  it("retains the formation changed by a mechanic across victory and the next battle", () => {
    let game = swapFixture(withReserves(), {
      type: "swap",
      activeId: "ally-0",
      reserve: "recruit-pollenmoth",
    });
    game = winBattle(game);
    if (game.phase === "recruit") game = completeRecruitment(game);
    if (game.phase === "boon") game = accept(game, { type: "skipBoon" });
    expect(game.team.map((c) => c.species)).toEqual(["pollenmoth", "emberback", "prismram"]);
    game = accept(game, { type: "beginBattle" });
    expect(
      game.cards.every((card) =>
        game.team.some(
          (c) =>
            c.id === card.ownerId &&
            CARDS.some((def) => def.id === card.definitionId && def.species === c.species),
        ),
      ),
    ).toBe(true);
    expect(decodeSave(encodeSave(game))).toEqual(game);
  });
});

it("rejects duplicate identities, missing cards and more than five individuals", () => {
  for (const modify of [
    (d: ReturnType<typeof withReserves>) => {
      d.reserves.push({ ...d.reserves[0]!, id: "extra-owned-creature" });
    },
    (d: ReturnType<typeof withReserves>) => {
      d.reserves[0]!.id = d.team[0]!.id;
    },

    (d: ReturnType<typeof withReserves>) => {
      d.battle!.draw = [];
    },
  ])
    expect(() => decodeSave(encodeSave(produce(withReserves(), modify)))).toThrow();
});
it("only loses when the entire roster falls and round-trips the defeat receipt", () => {
  let game = produce(withReserves(), (d) => {
    d.team.forEach((c) => {
      c.health = 1;
      ensureCombat(c).deathDoorUsed = true;
    });
    d.reserves.forEach((c) => (c.health = 0));
  });
  for (let i = 0; i < 30 && game.phase === "battle"; i++) game = accept(game, { type: "endTurn" });
  expect(game.phase).toBe("defeat");
  expect(game.reserves.every((c) => c.health === 0)).toBe(true);
  expect(decodeSave(encodeSave(game))).toEqual(game);
});
