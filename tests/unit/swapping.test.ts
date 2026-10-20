import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { dispatch } from "../../src/game/engine";
import { decodeSave, encodeSave } from "../../src/game/save";
import { CARDS, species } from "../../src/game/content";
import { accept, run, winBattle } from "./helpers";

export function withReserves() {
  return produce(run(), (d) => {
    for (const kind of ["silkmoth", "briartooth"] as const) {
      d.roster.push(kind);
      d.reserves.push({
        id: `recruit-${kind}`,
        species: kind,
        health: species(kind).health,
        block: 0,
        attacked: false,
      });
    }
  });
}
describe("free combat swaps", () => {
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
    const after = accept(before, { type: "swap", activeId: "ally-1", reserve: "silkmoth" });
    expect(after.rng).toBe(before.rng);
    expect(after.battle!.mana).toBe(3);
    expect(after.battle!.turn).toBe(1);
    for (const zone of ["hand", "draw", "discard"] as const)
      expect(after.battle![zone]).toEqual(before.battle![zone]);
    expect(after.lineup).toEqual(before.lineup);
    expect(after.battle!.enemies[0]!.targetId).toBe(after.team[1]!.id);
    expect(after.cards.filter((c) => c.ownerId === after.team[1]!.id).map((c) => c.definitionId)).toEqual(
      CARDS.filter((c) => c.species === "silkmoth").map((c) => c.id),
    );
    const back = accept(after, { type: "swap", activeId: after.team[1]!.id, reserve: "emberfox" });
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
      s = accept(s, { type: "swap", activeId: s.team[1]!.id, reserve: "silkmoth" });
      s = accept(s, { type: "swap", activeId: s.team[1]!.id, reserve: "emberfox" });
    }
    expect(s.team[1]!.attacked).toBe(true);
    expect(s.team[1]!.block).toBe(5);
    s = accept(s, { type: "swap", activeId: s.team[1]!.id, reserve: "silkmoth" });
    s = accept(s, { type: "endTurn" });
    const fox = s.reserves.find((c) => c.species === "emberfox")!;
    expect(fox.block).toBe(0);
    expect(fox.attacked).toBe(false);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("allows recovery after the deployed row falls, but rejects knocked-out reserves", () => {
    let s = produce(withReserves(), (d) => {
      d.team.forEach((c) => {
        c.health = 1;
        c.block = 0;
      });
      d.encounter = 1;
      // Use a real three-enemy encounter so all three allies fall in one enemy turn.
    });
    // Beginning that encounter supplies authored enemies; health is then reduced for the fixture.
    s = accept({ ...s, phase: "teamSelection", battle: null }, { type: "beginBattle" });
    s = produce(s, (d) =>
      d.team.forEach((c) => {
        c.health = 1;
        c.block = 0;
      }),
    );
    s = accept(s, { type: "endTurn" });
    expect(s.team.every((c) => c.health === 0)).toBe(true);
    expect(s.phase).toBe("battle");
    expect(s.battle!.mana).toBe(3);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    const ids = [...s.battle!.hand];
    const slot = s.cards.find((c) => ids.includes(c.id))!.ownerId;
    s = accept(s, { type: "swap", activeId: slot, reserve: "silkmoth" });
    expect(
      s.cards.some(
        (c) => ids.includes(c.id) && c.ownerId === s.team.find((c) => c.species === "silkmoth")!.id,
      ),
    ).toBe(true);
    const outgoing = s.reserves.find((c) => c.health === 0)!;
    expect(
      dispatch(s, { type: "swap", activeId: s.team.find((c) => c.health > 0)!.id, reserve: outgoing.species })
        .accepted,
    ).toBe(false);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("only loses when the entire five-creature roster is knocked out", () => {
    let s = produce(withReserves(), (d) => {
      d.team.forEach((c) => {
        c.health = 1;
        c.block = 0;
      });
      d.reserves.forEach((c) => {
        c.health = 0;
      });
    });
    for (let i = 0; i < 3 && s.phase === "battle"; i++) s = accept(s, { type: "endTurn" });
    expect(s.reward!.outcome).toBe("defeat");
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("rejects invalid swaps without touching state or randomness", () => {
    const s = withReserves();
    for (const [activeId, reserve] of [
      ["missing", "silkmoth"],
      ["ally-0", "emberfox"],
      ["ally-0", "moonhart"],
    ] as const) {
      expect(dispatch(s, { type: "swap", activeId, reserve }).state).toBe(s);
    }
    expect(dispatch(s, { type: "setLineup", activeId: "ally-0", reserve: "silkmoth" }).accepted).toBe(false);
  });
});
describe("optional starting lineup and save migration", () => {
  it("remembers the starting lineup independently of combat swaps and applies optional edits next battle", () => {
    let s = accept(withReserves(), { type: "swap", activeId: "ally-0", reserve: "silkmoth" });
    s = winBattle(s);
    expect(s.reserves.every((c) => c.health === species(c.species).health)).toBe(true);
    const snapshot = s.battle;
    s = accept(s, { type: "setLineup", activeId: "ally-0", reserve: "briartooth" });
    expect(s.lineup).toEqual(["briartooth", "emberfox", "stormfin"]);
    expect(s.battle).toEqual(snapshot);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    s = accept(s, { type: "continueReward" });
    if (s.phase === "recruit") s = accept(s, { type: "skipRecruit" });
    if (s.phase === "relic") s = accept(s, { type: "skipRelic" });
    s = accept(s, { type: "beginBattle" });
    expect(s.team.map((c) => c.species)).toEqual(s.lineup);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
  it("migrates version-three combat, knockout slots and a six-species roster without replaying outcomes", () => {
    const old = JSON.parse(encodeSave(withReserves()));
    old.version = 3;
    delete old.reserves;
    delete old.lineup;
    old.roster.push("moonhart");
    old.unlocked.push("moonhart");
    old.wins = 1;
    old.team[0].health = 0;
    for (const zone of ["hand", "draw", "discard"])
      old.battle[zone] = old.battle[zone].filter(
        (id: string) =>
          !old.cards.some((c: { id: string; ownerId: string }) => c.id === id && c.ownerId === "ally-0"),
      );
    const next = decodeSave(JSON.stringify(old));
    expect(next.version).toBe(6);
    expect(next.roster).toHaveLength(5);
    expect(next.reserves).toHaveLength(2);
    expect(next.unlocked).toContain("moonhart");
    expect(next.team[0]!.health).toBe(0);
    expect(next.battle!.turn).toBe(old.battle.turn);
    expect(next.revision).toBe(old.revision);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });
  it("rejects duplicate reserve identities, missing lineup members and a sixth creature", () => {
    const s = withReserves();
    for (const modify of [
      (d: typeof s) => {
        d.reserves[0]!.id = d.team[0]!.id;
      },
      (d: typeof s) => {
        d.lineup = ["mossback", "mossback", "stormfin"];
      },
      (d: typeof s) => {
        d.roster.push("moonhart");
      },
      (d: typeof s) => {
        d.reserves.pop();
      },
    ])
      expect(() => decodeSave(encodeSave(produce(s, modify)))).toThrow();
  });
});

it("restores the saved lineup after a tactical swap without retaining card owners from the bench", () => {
  let s = accept(withReserves(), { type: "swap", activeId: "ally-0", reserve: "silkmoth" });
  s = winBattle(s);
  s = accept(s, { type: "continueReward" });
  if (s.phase === "recruit") s = accept(s, { type: "skipRecruit" });
  if (s.phase === "relic") s = accept(s, { type: "skipRelic" });
  expect(s.team.map((c) => c.species)).toEqual(["mossback", "emberfox", "stormfin"]);
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

it("does not repair missing live cards or missing roster members while migrating legacy saves", () => {
  for (const corrupt of [
    (s: Record<string, unknown>) => {
      (s.battle as { draw: string[] }).draw = [];
    },
    (s: Record<string, unknown>) => {
      s.roster = ["mossback", "emberfox"];
    },
  ]) {
    const legacy = JSON.parse(encodeSave(withReserves()));
    legacy.version = 3;
    delete legacy.lineup;
    delete legacy.reserves;
    corrupt(legacy);
    expect(() => decodeSave(JSON.stringify(legacy))).toThrow();
  }
});

it("preserves a committed version-three defeat receipt even when the old roster had reserves", () => {
  let s = produce(withReserves(), (d) => {
    d.team.forEach((c) => {
      c.health = 1;
      c.block = 0;
    });
    d.reserves.forEach((c) => {
      c.health = 0;
    });
  });
  while (s.phase === "battle") s = accept(s, { type: "endTurn" });
  const old = JSON.parse(encodeSave(s));
  old.version = 3;
  delete old.reserves;
  delete old.lineup;
  const migrated = decodeSave(JSON.stringify(old));
  expect(migrated.reward).toEqual(s.reward);
  expect(migrated.currency).toBe(s.currency);
  expect(migrated.revision).toBe(s.revision);
  expect(migrated.reserves.every((c) => c.health === 0)).toBe(true);
  expect(decodeSave(encodeSave(migrated))).toEqual(migrated);
});
