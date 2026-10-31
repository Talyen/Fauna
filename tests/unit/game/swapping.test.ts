import {
  addReserve,
  addBackups,
  completeRecruitment,
  accept,
  run,
  teamRun,
  winBattle,
  swapFixture,
} from "../../support/game";
import { setBattleCards } from "../../support/cards";
import { freshCombat, ensureCombat } from "../../../src/game/combat/index";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch, previewCard } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { CARDS, definition, species } from "../../../src/game/content";
import { MAX_BATTLE_TURN } from "../../../src/game/state-limits";
import type { GameEvent } from "../../../src/game/types";
import { pendingReplacement, swapBackup, swapFromCard } from "../../../src/game/team";
import { chooseBattleCommand } from "../../../src/application/battle-policy";

function withReserves() {
  return produce(run(), (d) => {
    for (const kind of ["pollenmoth", "captoad"] as const) {
      addReserve(d, `recruit-${kind}`, kind, species(kind).health, freshCombat());
    }
  });
}

it("selects a requested living backup or leaves the exchange untouched when that choice is invalid", () => {
  const state = produce(teamRun(42, ["dulcera", "mossguard", "emberback"]), (draft) => {
    addReserve(draft, "first", "coralcurl", 10, freshCombat());
    addReserve(draft, "second", "dunefox", 10, freshCombat());
  });
  const rejectedEvents: GameEvent[] = [];
  const unchanged = produce(state, (draft) => {
    expect(swapFromCard(draft, draft.team[0]!, rejectedEvents, false, "missing")).toBeUndefined();
  });
  expect(unchanged).toBe(state);
  expect(rejectedEvents).toEqual([]);

  const events: GameEvent[] = [];
  const selected = produce(state, (draft) => {
    expect(swapFromCard(draft, draft.team[0]!, events, true, "second")?.id).toBe("second");
  });
  expect(selected.team[0]).toMatchObject({ id: "second", health: 11 });
  expect(selected.reserves.map((unit) => unit.id)).toEqual(["first", "ally-0"]);
  expect(events.filter((event) => event.kind === "heal")).toHaveLength(1);
  expect(decodeSave(encodeSave(selected))).toEqual(selected);
});

it.each(["coralcurl", "memento"] as const)(
  "delivers swap protection, arrival passives and the Saddle Pouch draw once in order for %s",
  (kind) => {
    const state = produce(teamRun(42, ["skybex", "dulcera", "emberback"]), (draft) => {
      addReserve(draft, "incoming", kind, 10, freshCombat());
      draft.team[0]!.block = 7;
      draft.boons = ["tide-anklet", "saddle-pouch", "dune-shuttle"];
    });
    for (const fromCard of [false, true]) {
      const events: GameEvent[] = [];
      const next = produce(state, (draft) => swapBackup(draft, "ally-0", "incoming", events, fromCard));
      const arrival = next.team.find((unit) => unit.id === "incoming")!;
      expect(arrival.health).toBe(11);
      expect(arrival.block).toBe(fromCard ? 9 : 1);
      expect(events).toMatchObject([
        { kind: "action", actionType: "swap", actorId: "incoming" },
        ...(fromCard ? [{ kind: "block", targetId: "incoming", amount: 7 }] : []),
        { kind: "action", actionType: "support", actorId: "ally-0", targetId: "incoming" },
        { kind: "block", targetId: "incoming", amount: 1 },
        { kind: "heal", targetId: "incoming", amount: 1 },
        ...(fromCard ? [{ kind: "block", targetId: "incoming", amount: 1 }] : []),
      ]);
      expect(decodeSave(encodeSave(next))).toEqual(next);
    }
  },
);

it("ends a zero-Mana play only after commitment, retaining previews, opt-out and the turn ceiling", () => {
  const state = produce(run(), (draft) => {
    const card = draft.cards.find((entry) => definition(entry.definitionId).effect === "guard")!;
    setBattleCards(draft, [card.id]);
    draft.battle!.mana = 1;
  });
  const command = { type: "play" as const, cardId: state.battle!.hand[0]! };
  const preview = previewCard(state, command.cardId);
  const manual = dispatch(state, { ...command, autoEndTurn: false });
  expect(manual.accepted).toBe(true);
  expect(preview.state).toEqual(manual.state);
  expect(preview.events).toEqual(manual.events);
  expect(manual.state.battle!.mana).toBe(0);
  expect(manual.state.battle!.turn).toBe(state.battle!.turn);
  const automatic = dispatch(state, command);
  expect(automatic.accepted).toBe(true);
  expect(automatic.state.battle!.turn).toBe(state.battle!.turn + 1);
  expect(automatic.events.slice(0, manual.events.length)).toEqual(manual.events);
  const ceiling = produce(state, (draft) => {
    draft.battle!.turn = MAX_BATTLE_TURN;
  });
  const stopped = dispatch(ceiling, command);
  expect(stopped.accepted).toBe(true);
  expect(stopped.state.battle!.turn).toBe(MAX_BATTLE_TURN);
  expect(stopped.state.battle!.mana).toBe(0);
  expect(decodeSave(encodeSave(stopped.state))).toEqual(stopped.state);
  expect(state.battle!.mana).toBe(1);
});

it.each([false, true])(
  "removes the outgoing creature's generated cards on a swap (ability: %s)",
  (fromCard) => {
    const game = produce(withReserves(), (draft) => {
      const original = draft.cards.find((card) => card.ownerId === draft.team[0]!.id)!;
      for (let index = 0; index < 4; index++) {
        const id = `copy-${index}`;
        draft.cards.push({ ...original, id, temporary: true });
      }
      const retained = draft.cards.find((card) => card.ownerId === draft.team[1]!.id)!;
      draft.cards.push({ ...retained, id: "copy-4", temporary: true });
      draft.battle!.copySerial = 5;
      const permanent = draft.cards.filter((card) => !card.temporary).map((card) => card.id);
      draft.battle!.hand = ["copy-0", ...permanent.slice(0, 5)];
      draft.battle!.buffer = ["copy-1", "copy-4"];
      draft.battle!.draw = ["copy-2", ...permanent.slice(5)];
      draft.battle!.discard = ["copy-3"];
      draft.team[0]!.health = 0;
    });
    expect(decodeSave(encodeSave(game))).toEqual(game);
    const next = produce(game, (draft) => {
      swapBackup(draft, draft.team[0]!.id, draft.reserves[0]!.id, [], fromCard);
    });
    expect(next.cards.filter((card) => card.temporary).map((card) => card.id)).toEqual(["copy-4"]);
    for (const zone of ["hand", "buffer", "draw", "discard"] as const)
      expect(next.battle![zone].some((id) => ["copy-0", "copy-1", "copy-2", "copy-3"].includes(id))).toBe(
        false,
      );
    expect(next.battle!.hand).toContain("copy-4");
    if (!fromCard) expect(next.rng).toBe(game.rng);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  },
);

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
      { type: "swap", activeId: "ally-0", reserve: "recruit-captoad" },
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
      d.reserves[1]!.health = 0;
    });
    expect(decodeSave(encodeSave(game))).toEqual(game);
    const command = chooseBattleCommand(game);
    expect(command).toEqual({ type: "swap", activeId: "ally-0", reserve: "recruit-pollenmoth" });
    const next = accept(game, command);
    expect(next.team[0]!.combat!.controlled).toBe("freeze");
    expect(next.team[0]!.combat!.controlTurns).toBe(1);
    expect(next.team[0]!.combat!.freeze).toBe(0);
    expect(next.team[0]!.block).toBe(0);
    expect(pendingReplacement(next)).toBeUndefined();
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it("keeps repeated replacement choices pending until the available backups are deployed", () => {
    let game = produce(withReserves(), (d) => d.team.forEach((c) => (c.health = 0)));
    for (const reserve of ["recruit-pollenmoth", "recruit-captoad"]) {
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
      addBackups(d, { ...d.reserves[0]!, id: "extra-owned-creature" });
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
