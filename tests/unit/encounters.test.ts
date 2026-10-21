import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { JOURNEY_LENGTH, encounterSource, encounterPacks } from "../../src/game/encounters";
import { decodeSave, encodeSave } from "../../src/game/save";
import { recruitChoice, accept, winBattle } from "./helpers";

function start(seed = 7) {
  return accept(accept(createGame(seed), { type: "draft", species: "mossguard" }), { type: "start" });
}
function enter(s = start()) {
  return accept(s, { type: "beginBattle" });
}

describe("journey encounters", () => {
  it("commits one deterministic encounter and exact enemies, preserved through read-only queries and reload", () => {
    const s = start();
    expect(start()).toEqual(s);
    expect(s.expedition!.pack).not.toBeNull();
    const before = encodeSave(s);
    const preview = encounterSource(s);
    expect(preview.name).toBe("Combat");
    expect(encodeSave(s)).toBe(before);
    const loaded = decodeSave(before);
    expect(loaded).toEqual(s);
    const battle = accept(loaded, { type: "beginBattle" });
    expect(
      battle.battle!.enemies.map(({ name, species, maxHealth, damage }) => ({
        name,
        species,
        health: maxHealth,
        damage,
      })),
    ).toEqual(
      preview.enemies.map(({ name, species, health, damage }) => ({ name, species, health, damage })),
    );
    expect(decodeSave(encodeSave(battle))).toEqual(battle);
  });

  it("uses the same ordinary enemy pool throughout the journey", () => {
    for (const encounter of [0, 1, 2, 4, 5, 6]) expect(encounterPacks(encounter)).toEqual(encounterPacks(0));
  });

  it("rejects entry outside the encounter screen without consuming RNG or changing state", () => {
    for (const s of [createGame(), enter()]) {
      const result = dispatch(s, { type: "beginBattle" });
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(s);
    }
  });

  it("runs eight encounters with bosses fourth and last and advances only after completing rewards", () => {
    let s = start();
    let earnings = 0;
    for (let index = 0; index < JOURNEY_LENGTH; index++) {
      expect(s.encounter).toBe(index);
      expect(s.support?.encounter ?? null).toBe([1, 5].includes(index) ? index : null);
      expect(encounterSource(s).name).toBe(index % 4 === 3 ? "Boss" : "Combat");
      expect(encounterSource(s).enemies).toHaveLength(Math.min(3, index + 1));
      const route = s.expedition;
      s = winBattle(enter(s));
      expect(["recruit", "boon", "teamSelection", "victory"]).toContain(s.phase);
      earnings += [3, 7].includes(index) ? 40 : 20;
      expect(s.currency).toBe(earnings);
      if (s.phase !== "teamSelection") expect(s.expedition).toEqual(route);
      expect(decodeSave(encodeSave(s))).toEqual(s);
      if (s.phase === "recruit") {
        s =
          s.roster.length < 3
            ? accept(s, { type: "recruit", species: s.reward!.recruits[0]! })
            : accept(s, recruitChoice(s));
        expect(decodeSave(encodeSave(s))).toEqual(s);
      }
      if (s.phase === "boon") s = accept(s, { type: "skipBoon" });
      expect(decodeSave(encodeSave(s))).toEqual(s);
      if (index < 7) {
        expect(s.phase).toBe("teamSelection");
        expect(s.expedition!.pack).not.toBeNull();
      }
    }
    expect(s.phase).toBe("victory");
    expect(s.wins).toBe(1);
    expect(s.unlocked).toContain("prismram");
  });

  it("rejects forged packs, progress and enemy receipts", () => {
    const s = enter();
    for (const mutate of [
      (d: typeof s) => {
        d.expedition!.pack = 100;
      },
      (d: typeof s) => {
        d.encounter = 2;
      },
      (d: typeof s) => {
        d.battle!.enemies[0]!.damage++;
      },
      (d: typeof s) => {
        d.expedition!.pack = null;
      },
    ])
      expect(() => decodeSave(encodeSave(produce(s, mutate)))).toThrow();
  });

  it("rejects obsolete destination and biome saves", () => {
    for (const version of [16, 17, 18])
      expect(() => decodeSave(JSON.stringify({ ...start(), version }))).toThrow();
  });

  it("allows abandonment before entering combat", () => {
    const abandoned = accept(start(), { type: "abandon" });
    expect(decodeSave(encodeSave(abandoned))).toEqual(abandoned);
  });
});
