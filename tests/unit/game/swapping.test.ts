import { freshCombat } from "../../../src/game/combat/index";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { combat } from "../../../src/game/combat/index";
import { dispatch } from "../../../src/game/engine";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { CARDS, species } from "../../../src/game/content";
import { recruitChoice, accept, run, winBattle } from "../../support/game";

export function withReserves() {
  return produce(run(), (d) => {
    for (const kind of ["pollenmoth", "emberback"] as const) {
      d.roster.push(kind);
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
describe("free combat swaps", () => {
  it("ticks every enemy's statuses while the deployed row waits for a living backup", () => {
    let state = accept(
      { ...structuredClone(withReserves()), phase: "teamSelection", battle: null, encounter: 1 },
      { type: "beginBattle" },
    );
    state = produce(state, (draft) => {
      for (const ally of draft.team) ally.health = 0;
      for (const enemy of draft.battle!.enemies) {
        enemy.combat = freshCombat();
        enemy.combat.poison = 1;
        enemy.combat.statusSources.poison = draft.reserves[0]!.id;
      }
    });
    expect(state.battle!.enemies.length).toBeGreaterThan(1);
    const next = accept(state, { type: "endTurn" });
    expect(next.phase).toBe("battle");
    expect(next.battle!.enemies.map((enemy) => enemy.health)).toEqual(
      state.battle!.enemies.map((enemy) => enemy.health - 1),
    );
    expect(next.battle!.enemies.every((enemy) => enemy.combat.poison === 0)).toBe(true);
    expect(decodeSave(encodeSave(next))).toEqual(next);
    const recovered = accept(next, {
      type: "swap",
      activeId: next.team[0]!.id,
      reserve: next.reserves[0]!.id,
    });
    expect(recovered.team[0]!.health).toBeGreaterThan(0);
  });
  it("replaces cards in hand, draw and discard without paying, drawing, shuffling, or changing the starting lineup", () => {
    const before = produce(withReserves(), (d) => {
      const owned = d.cards.filter((c) => c.ownerId === "ally-1");
      d.battle!.hand = [owned[0]!.id];
      d.battle!.discard = [owned[1]!.id];
      d.battle!.draw = d.cards.filter((c) => ![owned[0]!.id, owned[1]!.id].includes(c.id)).map((c) => c.id);
      d.team[1]!.health = 9;
      d.team[1]!.block = 7;
      d.team[1]!.attacked = true;
      d.battle!.enemies[0]!.targetId = "ally-1";
    });
    const after = accept(before, { type: "swap", activeId: "ally-1", reserve: "recruit-pollenmoth" });
    expect(after.rng).toBe(before.rng);
    expect(after.battle!.mana).toBe(4);
    expect(after.battle!.turn).toBe(1);
    for (const zone of ["hand", "draw", "discard"] as const)
      expect(after.battle![zone]).toEqual(before.battle![zone]);
    expect(after.lineup).toEqual(before.lineup);
    expect(after.battle!.enemies[0]!.targetId).toBe(after.team[1]!.id);
    expect(after.cards.filter((c) => c.ownerId === after.team[1]!.id).map((c) => c.definitionId)).toEqual(
      CARDS.filter((c) => c.species === "pollenmoth").map((c) => c.id),
    );
    const back = accept(after, { type: "swap", activeId: after.team[1]!.id, reserve: "ally-1" });
    expect(back.team[1]).toEqual(before.team[1]);
    expect(back.battle!.hand).toEqual(before.battle!.hand);
    expect(decodeSave(encodeSave(back))).toEqual(back);
  });
  it("never repeats opening grants or resets first-attack traits when cycling creatures", () => {
    let s = produce(withReserves(), (d) => {
      d.team[1]!.attacked = true;
      d.team[1]!.block = 5;
    });
    for (let i = 0; i < 5; i++) {
      s = accept(s, { type: "swap", activeId: s.team[1]!.id, reserve: "recruit-pollenmoth" });
      s = accept(s, { type: "swap", activeId: s.team[1]!.id, reserve: "ally-1" });
    }
    expect(s.team[1]!.attacked).toBe(true);
    expect(s.team[1]!.block).toBe(5);
    s = accept(s, { type: "swap", activeId: s.team[1]!.id, reserve: "recruit-pollenmoth" });
    s = accept(s, { type: "endTurn" });
    const fox = s.reserves.find((c) => c.species === "emberback")!;
    expect(fox.block).toBe(3);
    expect(fox.attacked).toBe(false);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("allows recovery after the deployed row falls, but rejects knocked-out reserves", () => {
    let s = produce(withReserves(), (d) => {
      d.team.forEach((c) => {
        c.health = 0;
        c.block = 0;
      });
      d.encounter = 1;
      // Use a real three-enemy encounter so all three allies fall in one enemy turn.
    });
    // Beginning that encounter supplies authored enemies; health is then reduced for the fixture.
    s = accept({ ...s, phase: "teamSelection", battle: null }, { type: "beginBattle" });
    s = produce(s, (d) =>
      d.team.forEach((c) => {
        c.health = 0;
        c.block = 0;
      }),
    );
    s = accept(s, { type: "endTurn" });
    expect(s.team.every((c) => c.health === 0)).toBe(true);
    expect(s.phase).toBe("battle");
    expect(s.battle!.mana).toBe(4);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    const ids = [...s.battle!.hand];
    const slot = s.cards.find((c) => ids.includes(c.id))!.ownerId;
    s = accept(s, { type: "swap", activeId: slot, reserve: "recruit-pollenmoth" });
    expect(
      s.cards.some(
        (c) => ids.includes(c.id) && c.ownerId === s.team.find((c) => c.species === "pollenmoth")!.id,
      ),
    ).toBe(true);
    const outgoing = s.reserves.find((c) => c.health === 0)!;
    expect(
      dispatch(s, { type: "swap", activeId: s.team.find((c) => c.health > 0)!.id, reserve: outgoing.id })
        .accepted,
    ).toBe(false);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("only loses when the entire five-creature roster is knocked out", () => {
    let s = produce(withReserves(), (d) => {
      d.team.forEach((c) => {
        c.health = 1;
        c.block = 0;
        combat(c).deathDoorUsed = true;
      });
      d.reserves.forEach((c) => {
        c.health = 0;
      });
    });
    for (let i = 0; i < 20 && s.phase === "battle"; i++) s = accept(s, { type: "endTurn" });
    expect(s.reward!.outcome).toBe("defeat");
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("rejects invalid swaps without touching state or randomness", () => {
    const s = withReserves();
    for (const [activeId, reserve] of [
      ["missing", "pollenmoth"],
      ["ally-0", "emberback"],
      ["ally-0", "prismram"],
    ] as const) {
      expect(dispatch(s, { type: "swap", activeId, reserve }).state).toBe(s);
    }
    expect(
      dispatch(s, { type: "setLineup", activeId: "ally-0", reserve: "recruit-pollenmoth" }).accepted,
    ).toBe(false);
  });
});
describe("optional starting lineup and save validation", () => {
  it("remembers the starting lineup independently of combat swaps and applies optional edits next battle", () => {
    let s = accept(withReserves(), { type: "swap", activeId: "ally-0", reserve: "recruit-pollenmoth" });
    s = winBattle(s);
    expect(s.reserves.every((c) => c.health === species(c.species).health)).toBe(true);
    const snapshot = s.battle;
    s = accept(s, { type: "setLineup", activeId: "ally-0", reserve: "recruit-emberback" });
    expect(s.lineup).toEqual(["recruit-emberback", "ally-1", "ally-2"]);
    expect(s.battle).toEqual(snapshot);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    if (s.phase === "recruit") s = accept(s, recruitChoice(s));
    if (s.phase === "boon") s = accept(s, { type: "skipBoon" });
    s = accept(s, { type: "beginBattle" });
    expect(s.team.map((c) => c.id)).toEqual(s.lineup);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("rejects duplicate reserve identities, missing lineup members and a sixth creature", () => {
    const s = withReserves();
    for (const modify of [
      (d: typeof s) => {
        d.reserves[0]!.id = d.team[0]!.id;
      },
      (d: typeof s) => {
        d.lineup = ["mossguard", "mossguard", "prismram"];
      },
      (d: typeof s) => {
        d.roster.push("prismram");
      },
      (d: typeof s) => {
        d.reserves.pop();
      },
    ])
      expect(() => decodeSave(encodeSave(produce(s, modify)))).toThrow();
  });
});

it("restores the saved lineup after a tactical swap without retaining card owners from the bench", () => {
  let s = accept(withReserves(), { type: "swap", activeId: "ally-0", reserve: "recruit-pollenmoth" });
  s = winBattle(s);
  if (s.phase === "recruit") s = accept(s, recruitChoice(s));
  if (s.phase === "boon") s = accept(s, { type: "skipBoon" });
  expect(s.team.map((c) => c.species)).toEqual(["mossguard", "emberback", "prismram"]);
  expect(
    s.cards.every((card) =>
      s.team.some(
        (c) =>
          c.id === card.ownerId &&
          CARDS.some((def) => def.id === card.definitionId && def.species === c.species),
      ),
    ),
  ).toBe(true);
  expect(decodeSave(encodeSave(s))).toEqual(s);
  s = accept(s, { type: "beginBattle" });
  expect(decodeSave(encodeSave(s))).toEqual(s);
});

it("rejects current saves with missing live cards or roster members", () => {
  for (const corrupt of [
    (s: Record<string, unknown>) => {
      (s.battle as { draw: string[] }).draw = [];
    },
    (s: Record<string, unknown>) => {
      s.roster = ["mossguard", "emberback"];
    },
  ]) {
    const current = JSON.parse(encodeSave(withReserves()));
    corrupt(current);
    expect(() => decodeSave(JSON.stringify(current))).toThrow();
  }
});

it("round-trips a committed defeat receipt with knocked-out reserves", () => {
  let s = produce(withReserves(), (d) => {
    d.team.forEach((c) => {
      c.health = 1;
      c.block = 0;
    });
    d.reserves.forEach((c) => {
      c.health = 0;
    });
  });
  for (let turn = 0; turn < 100 && s.phase === "battle"; turn++) s = accept(s, { type: "endTurn" });
  expect(s.phase).toBe("defeat");
  const restored = decodeSave(encodeSave(s));
  expect(restored).toEqual(s);
  expect(restored.reserves.every((c) => c.health === 0)).toBe(true);
});
