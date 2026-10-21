import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch, starterCount } from "../../src/game/engine";
import { FIRST_RUN_STARTERS } from "../../src/game/content";
import { decodeSave, encodeSave } from "../../src/game/save";
import { accept, recruitChoice, winBattle } from "./helpers";

function firstJourney(seed = 7) {
  const game = createGame(seed);
  return accept(accept(game, { type: "draft", species: game.starterOffers[0]! }), { type: "start" });
}

describe("collected starter drafts", () => {
  it("onboards with one of three eligible creatures and collects only the committed starter", () => {
    let s = createGame(7);
    expect(s.discovery.recruited).toEqual({});
    expect(s.starterOffers).toHaveLength(3);
    expect(new Set(s.starterOffers).size).toBe(3);
    expect(s.starterOffers.every((kind) => FIRST_RUN_STARTERS.includes(kind))).toBe(true);
    expect(starterCount(s)).toBe(1);
    const chosen = s.starterOffers[0]!;
    s = accept(s, { type: "draft", species: chosen });
    expect(s.discovery.recruited).toEqual({});
    expect(s.starterOffers).toEqual([]);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    expect(dispatch(s, { type: "draft", species: chosen }).state).toBe(s);
    s = accept(s, { type: "start" });
    expect(s.discovery.recruited).toEqual({ [chosen]: 1 });
    expect(s.team).toHaveLength(1);
    expect(s.cards).toHaveLength(3);
    expect(decodeSave(encodeSave(s))).toEqual(s);
  });

  it("grows the onboarding team through compulsory recruitment against one, then two enemies", () => {
    let s = firstJourney();
    for (let round = 0; round < 2; round++) {
      s = accept(s, { type: "beginBattle" });
      expect(s.battle!.enemies).toHaveLength(round + 1);
      s = winBattle(s);
      expect(s.reward!.recruits).toHaveLength(round + 1);
      expect(dispatch(s, { type: "skipRecruit" }).state).toBe(s);
      s = accept(s, recruitChoice(s));
      expect(s.team).toHaveLength(round + 2);
      expect(s.cards).toHaveLength((round + 2) * 3);
      expect(decodeSave(encodeSave(s))).toEqual(s);
    }
  });

  it("drafts three times from recruits alone, preserving every offer across reload", () => {
    let s = firstJourney();
    s = accept(s, { type: "abandon" });
    s = produce(s, (d) => {
      d.discovery.encountered = ["mossback", "emberfox", "stormfin", "moonhart"];
      d.discovery.recruited = { mossback: 1, emberfox: 1, stormfin: 1 };
      d.selected = ["mossback"];
    });
    s = accept(s, { type: "newRun", seed: 24 });
    const initial = s;
    for (let round = 0; round < 3; round++) {
      expect(s.selected).toHaveLength(round);
      expect(s.starterOffers).toHaveLength(3);
      expect(new Set(s.starterOffers)).toEqual(new Set(Object.keys(s.discovery.recruited)));
      expect(dispatch(s, { type: "draft", species: "moonhart" }).state).toBe(s);
      expect(dispatch(s, { type: "start" }).state).toBe(s);
      s = decodeSave(encodeSave(s));
      s = accept(s, { type: "draft", species: "mossback" });
    }
    expect(s.starterOffers).toEqual([]);
    expect(s.selected).toEqual(["mossback", "mossback", "mossback"]);
    expect(initial.selected).toEqual([]);
    s = accept(s, { type: "start" });
    expect(s.team).toHaveLength(3);
    expect(new Set(s.team.map((c) => c.id)).size).toBe(3);
    expect(s.cards).toHaveLength(9);
    expect(decodeSave(encodeSave(s))).toEqual(s);
    s = accept(s, { type: "beginBattle" });
    expect(s.battle!.enemies).toHaveLength(1);
  });

  it("supports repeat journeys after an early return with only one collected species", () => {
    let s = firstJourney();
    const collected = s.team[0]!.species;
    s = accept(accept(s, { type: "abandon" }), { type: "newRun", seed: 9 });
    for (let round = 0; round < 3; round++) {
      expect(s.starterOffers).toEqual([collected, collected, collected]);
      s = accept(decodeSave(encodeSave(s)), { type: "draft", species: collected });
    }
    expect(accept(s, { type: "start" }).team).toHaveLength(3);
  });

  it("includes both collected species when a later draft pool has fewer than three", () => {
    let s = firstJourney();
    s = accept(s, { type: "abandon" });
    s = produce(s, (d) => {
      d.discovery = { encountered: ["mossback", "emberfox"], recruited: { mossback: 1, emberfox: 1 } };
      d.selected = ["mossback"];
    });
    s = accept(s, { type: "newRun", seed: 42 });
    expect(new Set(s.starterOffers)).toEqual(new Set(["mossback", "emberfox"]));
    expect(decodeSave(encodeSave(s))).toEqual(s);
    expect(() =>
      decodeSave(JSON.stringify({ ...s, starterOffers: ["mossback", "mossback", "mossback"] })),
    ).toThrow();
  });

  it("rejects forged offers, uncollected selections and obsolete saves", () => {
    const s = createGame();
    for (const change of [
      { starterOffers: ["moonhart"] },
      { selected: ["mossback", "emberfox"] },
      { starterOffers: [] },
      { version: 20 },
      { version: 21 },
    ])
      expect(() => decodeSave(JSON.stringify({ ...s, ...change }))).toThrow();
    expect(createGame(7)).toEqual(createGame(7));
  });
});
