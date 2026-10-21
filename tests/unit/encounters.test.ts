import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { BIOMES, encounterSource } from "../../src/game/encounters";
import { decodeSave, encodeSave } from "../../src/game/save";
import { accept, winBattle } from "./helpers";

function start(seed = 7) {
  return accept(accept(createGame(seed), { type: "draft", species: "mossback" }), { type: "start" });
}
function enter(s = start()) {
  return accept(s, { type: "beginBattle" });
}

describe("biome encounters", () => {
  it("commits one deterministic encounter and exact enemies, preserved through inspection and reload", () => {
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

  it("rejects entry outside the encounter screen without consuming RNG or changing state", () => {
    for (const s of [createGame(), enter()]) {
      const result = dispatch(s, { type: "beginBattle" });
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(s);
    }
  });

  it("offers three fights then a boss per biome and advances only after completing rewards", () => {
    let s = start();
    for (let index = 0; index < BIOMES.length * 4; index++) {
      expect(s.expedition!.biome).toBe(Math.floor(index / 4));
      expect(s.expedition!.step).toBe(index % 4);
      expect(encounterSource(s).name).toBe(index % 4 === 3 ? "Boss" : "Combat");
      const route = s.expedition;
      s = winBattle(enter(s));
      expect(["recruit", "boon", "teamSelection", "victory"]).toContain(s.phase);
      expect(s.currency).toBe(Math.floor(index / 4) * 100 + (index % 4 === 3 ? 100 : ((index % 4) + 1) * 20));
      if (s.phase !== "teamSelection") expect(s.expedition).toEqual(route);
      expect(decodeSave(encodeSave(s))).toEqual(s);
      if (s.phase === "recruit") {
        s =
          s.roster.length < 3
            ? accept(s, { type: "recruit", species: s.reward!.recruits[0]! })
            : accept(s, { type: "skipRecruit" });
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
    expect(s.unlocked).toContain("moonhart");
  });

  it("rejects forged packs, progress and enemy receipts", () => {
    const s = enter();
    for (const mutate of [
      (d: typeof s) => {
        d.expedition!.pack = 100;
      },
      (d: typeof s) => {
        d.expedition!.biome = 1;
      },
      (d: typeof s) => {
        d.expedition!.step = 2;
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

  it("rejects obsolete destination saves", () => {
    expect(() => decodeSave(JSON.stringify({ ...start(), version: 16 }))).toThrow();
  });

  it("allows abandonment before entering combat", () => {
    const abandoned = accept(start(), { type: "abandon" });
    expect(decodeSave(encodeSave(abandoned))).toEqual(abandoned);
  });
});
