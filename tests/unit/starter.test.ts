import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../src/game/engine";
import { INITIAL_SPECIES } from "../../src/game/content";
import { decodeSave, encodeSave } from "../../src/game/save";
import { accept, policy, run, winBattle } from "./helpers";

const start = () => accept(accept(createGame(7), { type: "draft", species: "mossback" }), { type: "start" });

describe("one-starter expeditions", () => {
  it("keeps the selected starter through saving, replaces it explicitly, and rejects locked choices", () => {
    let s = accept(createGame(7), { type: "draft", species: "mossback" });
    expect(decodeSave(encodeSave(s))).toEqual(s);
    const rng = s.rng;
    s = accept(s, { type: "draft", species: "emberfox" });
    expect(s.selected).toEqual(["emberfox"]);
    expect(s.rng).toBe(rng);
    expect(dispatch(s, { type: "draft", species: "moonhart" }).state).toBe(s);
    expect(decodeSave(encodeSave(accept(s, { type: "start" })))).toEqual(accept(s, { type: "start" }));
  });

  it("resumes old unfinished drafts with one choice and preserves existing three-creature battles", () => {
    const legacy = produce(createGame(), (d) => {
      d.selected = ["mossback", "emberfox", "stormfin"];
    });
    const resumed = decodeSave(encodeSave(legacy));
    expect(resumed.selected).toEqual(["mossback"]);
    expect(accept(resumed, { type: "start" }).team).toHaveLength(1);
    expect(decodeSave(encodeSave(run()))).toEqual(run());
  });

  it("adds recruits to the first three lineup slots and saves the settled battle before relic choice", () => {
    let s = start();
    for (const recruit of ["briartooth", "stormfin"] as const) {
      s = accept(s, { type: "beginBattle" });
      s = accept(winBattle(s), { type: "continueReward" });
      s = accept(s, { type: "recruit", species: recruit });
      expect(s.team).toHaveLength(recruit === "briartooth" ? 2 : 3);
      expect(s.lineup).toEqual(s.roster);
      expect(s.reserves).toEqual([]);
      expect(decodeSave(encodeSave(s))).toEqual(s);
      s = accept(s, { type: "skipRelic" });
      expect(decodeSave(encodeSave(s))).toEqual(s);
    }
    expect(s.cards).toHaveLength(9);
  });

  it("can skip recruitment and begin the next battle with one creature", () => {
    let s = accept(start(), { type: "beginBattle" });
    s = accept(accept(winBattle(s), { type: "continueReward" }), { type: "skipRecruit" });
    s = accept(accept(s, { type: "skipRelic" }), { type: "beginBattle" });
    expect(s.team).toHaveLength(1);
    expect(s.battle!.hand).toHaveLength(3);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });

  it("rejects undersized lineups when creatures exist to fill them", () => {
    const invalid = produce(run(), (d) => {
      d.reserves.push(d.team.pop()!);
      d.lineup.pop();
    });
    expect(() => decodeSave(encodeSave(invalid))).toThrow();
  });

  it.each(INITIAL_SPECIES)("supports a complete saved expedition from %s", (kind) => {
    let s = accept(accept(accept(createGame(7), { type: "draft", species: kind }), { type: "start" }), {
      type: "beginBattle",
    });
    for (let i = 0; i < 200 && !["victory", "defeat"].includes(s.phase); i++) {
      s = accept(s, s.phase === "recruit" ? { type: "recruit", species: s.reward!.recruits[0]! } : policy(s));
      expect(decodeSave(encodeSave(s))).toEqual(s);
    }
    expect(s.phase).toBe("victory");
    expect(s.roster).toHaveLength(3);
  });
});
