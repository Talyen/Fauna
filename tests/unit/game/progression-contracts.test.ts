import { expect, it } from "vitest";
import { produce } from "immer";
import { TALENTS } from "../../../src/game/content";
import { createGame, dispatch } from "../../../src/game/engine";
import { KEYWORDS, xpThreshold } from "../../../src/game/progression";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { accept } from "../../support/game";

it("resumes legal Talent purchases and rejects missing prerequisites or category overspending", () => {
  for (const keyword of KEYWORDS) {
    const tree = TALENTS.filter((talent) => talent.keyword === keyword);
    const base = produce(createGame(7), (draft) => {
      draft.keywordXP[keyword] = 1_000_000;
    });
    let state = base;
    for (const talent of [...tree].sort((a, b) => a.row - b.row)) {
      state = accept(state, { type: "buyTalent", talentId: talent.id });
      expect(decodeSave(encodeSave(state))).toEqual(state);
      const overspent = produce(state, (draft) => {
        draft.keywordXP[keyword] = xpThreshold(draft.talents.length) - 1;
      });
      expect(() => decodeSave(encodeSave(overspent))).toThrow();
      const earlier = tree.find((entry) => entry.row < talent.row);
      if (earlier) {
        const missing = produce(state, (draft) => {
          draft.talents = draft.talents.filter((id) => id !== earlier.id);
        });
        expect(() => decodeSave(encodeSave(missing))).toThrow();
        const beforePurchase = produce(missing, (draft) => {
          draft.talents = draft.talents.filter((id) => id !== talent.id);
        });
        const rejected = dispatch(beforePurchase, { type: "buyTalent", talentId: talent.id });
        expect(rejected.accepted).toBe(false);
        expect(rejected.state).toBe(beforePurchase);
      }
    }
    const reset = accept(state, { type: "resetTalents", keyword });
    expect(reset.talents).toEqual([]);
    expect(reset.keywordXP).toEqual(base.keywordXP);
    expect(decodeSave(encodeSave(reset))).toEqual(reset);
  }
});

it("rejects duplicate Talent purchases in saved selections", () => {
  const state = produce(createGame(7), (draft) => {
    draft.keywordXP.burn = 1_000_000;
    draft.talents = ["burn.flashpoint", "burn.flashpoint"];
  });
  expect(() => decodeSave(encodeSave(state))).toThrow();
});

it("preserves mixed starter offers on resume and excludes Legendaries after an ordinary choice", () => {
  const collected = produce(createGame(7), (draft) => {
    draft.discovery = {
      encountered: ["mossguard", "emberback", "memento"],
      recruited: { mossguard: 1, emberback: 1, memento: 1 },
    };
  });
  const initial = accept(collected, { type: "newRun", seed: 42 });
  expect(new Set(initial.starterOffers)).toEqual(new Set(["mossguard", "emberback", "memento"]));
  expect(decodeSave(encodeSave(initial))).toEqual(initial);

  const ordinary = accept(initial, { type: "draft", species: "mossguard" });
  expect(new Set(ordinary.starterOffers)).toEqual(new Set(["mossguard", "emberback"]));
  expect(ordinary.starterOffers).toHaveLength(3);
  expect(decodeSave(encodeSave(ordinary))).toEqual(ordinary);
  expect(() => decodeSave(JSON.stringify({ ...ordinary, starterOffers: initial.starterOffers }))).toThrow();
  const rejected = dispatch(ordinary, { type: "draft", species: "memento" });
  expect(rejected.accepted).toBe(false);
  expect(rejected.state).toBe(ordinary);

  const legendary = accept(initial, { type: "draft", species: "memento" });
  expect(legendary.starterOffers).toEqual([]);
  expect(decodeSave(encodeSave(legendary))).toEqual(legendary);
  expect(accept(legendary, { type: "start" }).team.map((unit) => unit.species)).toEqual(["memento"]);
});
