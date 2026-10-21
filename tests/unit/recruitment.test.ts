import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { COMBAT_PACKS } from "../../src/game/encounters";
import { decodeSave, encodeSave } from "../../src/game/save";
import { accept, run, winBattle } from "./helpers";

describe("recruiting creature copies", () => {
  it("offers exactly the three defeated enemies, including repeated species and roster members", () => {
    for (const pack of COMBAT_PACKS) expect(pack).toHaveLength(3);
    const started = accept(accept(createGame(7), { type: "draft", species: "stormfin" }), { type: "start" });
    const battle = accept(
      produce(started, (d) => {
        d.encounter = 4;
        d.journey = null;
        d.expedition = {
          pack: COMBAT_PACKS.findIndex((pack) => pack[0] === "stormfin" && pack[1] === "stormfin"),
        };
      }),
      { type: "beginBattle" },
    );
    const reward = winBattle(battle);
    expect(reward.reward!.recruits).toEqual(["stormfin", "stormfin", "briartooth"]);
    expect(decodeSave(encodeSave(reward))).toEqual(reward);
    expect(() =>
      decodeSave(
        encodeSave(
          produce(reward, (d) => {
            d.reward!.recruits.pop();
          }),
        ),
      ),
    ).toThrow();
    const next = accept(reward, { type: "recruit", species: "stormfin" });
    expect(next.roster).toEqual(["stormfin", "stormfin"]);
    expect(new Set(next.team.map((c) => c.id)).size).toBe(2);
    expect(decodeSave(encodeSave(next))).toEqual(next);
  });

  it("swaps and remembers the chosen copy without merging card ownership, health or identity", () => {
    let s = accept(winBattle(run()), { type: "recruit", species: "emberfox" });
    const copy = s.reserves[0]!;
    expect(copy.id).not.toBe("ally-1");
    s = accept(s, { type: "setLineup", activeId: "ally-1", reserve: copy.id });
    expect(s.lineup[1]).toBe(copy.id);
    s = accept(decodeSave(encodeSave(s)), { type: "beginBattle" });
    s = produce(s, (d) => {
      d.team[1]!.health = 9;
      d.team[1]!.attacked = true;
      d.reserves[0]!.health = 17;
    });
    const zones = [s.battle!.hand, s.battle!.draw, s.battle!.discard];
    s = accept(s, { type: "swap", activeId: copy.id, reserve: "ally-1" });
    expect(s.team[1]!.id).toBe("ally-1");
    expect(s.team[1]!.health).toBe(17);
    expect(s.reserves[0]!.health).toBe(9);
    expect(s.reserves[0]!.attacked).toBe(true);
    expect(s.cards.filter((c) => c.ownerId === "ally-1")).toHaveLength(3);
    expect(s.cards.some((c) => c.ownerId === copy.id)).toBe(false);
    expect([s.battle!.hand, s.battle!.draw, s.battle!.discard]).toEqual(zones);
    expect(s.lineup[1]).toBe(copy.id);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });

  it("releases only the chosen copy at five and updates its lineup entry", () => {
    let s = accept(winBattle(), { type: "recruit", species: "emberfox" });
    s = accept(s, { type: "beginBattle" });
    s = accept(winBattle(s), { type: "recruit", species: "mossguard" });
    const copies = s.reserves.map((c) => c.id);
    s = accept(s, { type: "beginBattle" });
    // Replay an ordinary combat for the replacement decision.
    s = winBattle(
      accept(
        produce(s, (d) => {
          d.phase = "teamSelection";
          d.battle = null;
          d.encounter = 0;
        }),
        { type: "beginBattle" },
      ),
    );
    expect(dispatch(s, { type: "skipRecruit" }).state).toBe(s);
    expect(dispatch(s, { type: "recruit", species: "emberfox" }).accepted).toBe(false);
    expect(s.discovery.recruited.emberfox).toBe(2);
    s = accept(s, { type: "recruit", species: "emberfox", replace: "ally-1" });
    expect(s.discovery.recruited.emberfox).toBe(3);
    expect(s.discovery.recruited.mossguard).toBe(2);
    const all = [...s.team, ...s.reserves];
    expect(all.some((c) => c.id === "ally-1")).toBe(false);
    expect(copies.every((id) => all.some((c) => c.id === id))).toBe(true);
    expect(all.filter((c) => c.species === "emberfox")).toHaveLength(2);
    expect(s.lineup[1]).toBe(s.team[1]!.id);
    expect(new Set(all.map((c) => c.id)).size).toBe(5);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });
});
