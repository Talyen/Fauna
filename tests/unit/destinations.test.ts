import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { BIOMES, encounterSource } from "../../src/game/destinations";
import { decodeSave, encodeSave } from "../../src/game/save";
import { accept, run, winBattle } from "./helpers";

function start(seed = 7) {
  return accept(accept(createGame(seed), { type: "draft", species: "mossback" }), { type: "start" });
}
function enter(s = start()) {
  return accept(s, { type: "beginBattle", destination: s.expedition!.offers[0]!.location });
}

describe("biome destinations", () => {
  it("commits deterministic offers and exact enemies, preserved through inspection and reload", () => {
    const s = start();
    expect(start()).toEqual(s);
    expect(s.expedition!.offers).toHaveLength(3);
    expect(new Set(s.expedition!.offers.map((offer) => offer.location)).size).toBe(3);
    expect(start(91).expedition!.offers).not.toEqual(s.expedition!.offers);
    const before = encodeSave(s);
    const destination = s.expedition!.offers[1]!.location;
    const preview = encounterSource(s, destination);
    expect(encodeSave(s)).toBe(before);
    const loaded = decodeSave(before);
    expect(loaded).toEqual(s);
    const battle = accept(loaded, { type: "beginBattle", destination });
    expect(
      battle.battle!.enemies.map(({ name, species, maxHealth, damage }) => ({
        name,
        species,
        health: maxHealth,
        damage,
      })),
    ).toEqual(preview.enemies.map(({ damageType: _, ...entry }) => entry));
    expect(decodeSave(encodeSave(battle))).toEqual(battle);
  });

  it("rejects absent, foreign, and repeated entries without consuming RNG or changing state", () => {
    const s = start();
    for (const destination of [undefined, "moonwell", "constructor"]) {
      const result = dispatch(s, { type: "beginBattle", destination });
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(s);
    }
    const battle = enter(s);
    expect(
      dispatch(battle, { type: "beginBattle", destination: s.expedition!.offers[0]!.location }).state,
    ).toBe(battle);
  });

  it("offers three fights then a boss per biome and advances only after completing rewards", () => {
    let s = start();
    for (let index = 0; index < BIOMES.length * 4; index++) {
      expect(s.expedition!.biome).toBe(Math.floor(index / 4));
      expect(s.expedition!.step).toBe(index % 4);
      expect(s.expedition!.offers).toHaveLength(index % 4 === 3 ? 1 : 3);
      if (index % 4 === 3)
        expect(s.expedition!.offers[0]!.location).toBe(BIOMES[Math.floor(index / 4)]!.boss);
      const selected = s.expedition!.offers[0]!.location;
      s = winBattle(enter(s));
      expect(s.phase).toBe("reward");
      expect(s.currency).toBe(Math.floor(index / 4) * 100 + (index % 4 === 3 ? 100 : ((index % 4) + 1) * 20));
      expect(s.expedition!.chosen).toBe(selected);
      expect(decodeSave(encodeSave(s))).toEqual(s);
      s = accept(s, { type: "continueReward" });
      if (s.phase === "recruit") {
        s =
          s.roster.length < 3
            ? accept(s, { type: "recruit", species: s.reward!.recruits[0]! })
            : accept(s, { type: "skipRecruit" });
        expect(decodeSave(encodeSave(s))).toEqual(s);
      }
      if (s.phase === "relic") s = accept(s, { type: "skipRelic" });
      expect(decodeSave(encodeSave(s))).toEqual(s);
      if (index < 7) {
        expect(s.phase).toBe("teamSelection");
        expect(s.expedition!.chosen).toBeNull();
        expect(s.expedition!.offers.some((offer) => offer.location === selected)).toBe(false);
      }
    }
    expect(s.phase).toBe("victory");
    expect(s.wins).toBe(1);
    expect(s.unlocked).toContain("moonhart");
  });

  it("rejects forged packs, cross-biome offers, progress and enemy receipts", () => {
    const s = enter();
    for (const mutate of [
      (d: typeof s) => {
        d.expedition!.offers[0]!.pack = 8;
      },
      (d: typeof s) => {
        d.expedition!.offers[0]!.location = "moonwell";
      },
      (d: typeof s) => {
        d.expedition!.step = 2;
      },
      (d: typeof s) => {
        d.battle!.enemies[0]!.damage++;
      },
      (d: typeof s) => {
        d.expedition!.chosen = null;
      },
    ])
      expect(() => decodeSave(encodeSave(produce(s, mutate)))).toThrow();
  });

  it("preserves active version-four expeditions and allows abandonment before entering", () => {
    const old = { ...run(), version: 4, expedition: undefined };
    const migrated = decodeSave(JSON.stringify(old));
    expect(migrated.expedition).toBeNull();
    expect(migrated.battle).toEqual(old.battle);
    const abandoned = accept(start(), { type: "abandon" });
    expect(decodeSave(encodeSave(abandoned))).toEqual(abandoned);
  });
});
