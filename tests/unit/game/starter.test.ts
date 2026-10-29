import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createGame, dispatch } from "../../../src/game/engine";
import { starterCount } from "../../../src/game/progression";
import { CARDS, FIRST_RUN_STARTERS, SPECIES } from "../../../src/game/content";
import { encounterPacks } from "../../support/encounter-packs";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { authoredPack, accept, completeRecruitment, winBattle } from "../../support/game";

function firstJourney(seed = 7) {
  const game = createGame(seed);
  return accept(accept(game, { type: "draft", species: game.starterOffers[0]! }), { type: "start" });
}

describe("collected starter drafts", () => {
  it.each(["rookhaven", "mossguard", "pollenmoth", "dawncall", "shadebrim"] as const)(
    "keeps %s recruitable and draftable after collection without offering it as a first solo starter",
    (kind) => {
      expect(SPECIES.some((entry) => entry.id === kind)).toBe(true);
      expect(FIRST_RUN_STARTERS).not.toContain(kind);
      for (let seed = 0; seed < 32; seed++) {
        const fresh = createGame(seed);
        expect(fresh.starterOffers).not.toContain(kind);
        expect(dispatch(fresh, { type: "draft", species: kind }).state).toBe(fresh);
      }
      const encounter = produce(firstJourney(42), (draft) => {
        draft.expedition!.pack = authoredPack(
          draft.encounter,
          encounterPacks(0).findIndex((pack) => pack[0] === kind),
        );
      });
      const won = winBattle(accept(encounter, { type: "beginBattle" }));
      expect(won.reward!.recruits).toContain(kind);
      const collected = accept(won, { type: "recruit", species: kind });
      expect(collected.discovery.recruited[kind]).toBe(1);
      let later = accept(accept(collected, { type: "abandon" }), { type: "newRun", seed: 42 });
      later = accept(decodeSave(encodeSave(later)), { type: "draft", species: kind });
      while (later.selected.length < starterCount(later))
        later = accept(later, { type: "draft", species: later.starterOffers[0]! });
      later = accept(later, { type: "start" });
      expect(later.team.map((creature) => creature.species)).toContain(kind);
      expect(new Set(later.team.map((creature) => creature.species)).size).toBe(later.team.length);
      expect(decodeSave(encodeSave(later))).toEqual(later);
    },
  );

  it("rejects the obsolete draft format rather than migrating saved starter offers", () => {
    expect(() => decodeSave(JSON.stringify({ ...createGame(42), version: 48 }))).toThrow();
  });

  it("offers only solo-capable starters while retaining collected support creatures for later drafts", () => {
    for (const kind of FIRST_RUN_STARTERS)
      expect(CARDS.some((card) => card.species === kind && card.effect === "attack")).toBe(true);
    const fresh = createGame(42);
    expect(FIRST_RUN_STARTERS).not.toContain("bloomquail");
    expect(dispatch(fresh, { type: "draft", species: "bloomquail" }).state).toBe(fresh);
    const collected = produce(fresh, (draft) => {
      draft.discovery = { encountered: ["bloomquail"], recruited: { bloomquail: 1 } };
    });
    const later = accept(collected, { type: "newRun", seed: 42 });
    expect(starterCount(later)).toBe(1);
    expect(later.starterOffers).toEqual(["bloomquail"]);
    expect(dispatch(later, { type: "draft", species: "bloomquail" }).accepted).toBe(true);
  });
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

  it("grows the onboarding team through recruitment against one, then two enemies", () => {
    let s = firstJourney();
    for (let round = 0; round < 2; round++) {
      s = accept(s, { type: "beginBattle" });
      expect(s.battle!.enemies).toHaveLength(round + 1);
      s = winBattle(s);
      expect(s.reward!.recruits).toHaveLength(round + 1);
      s = completeRecruitment(s);
      expect(s.team).toHaveLength(round + 2);
      expect(s.cards).toHaveLength((round + 2) * 3);
      expect(decodeSave(encodeSave(s))).toEqual(s);
    }
  });

  it("drafts three times from recruits alone, preserving every offer across reload", () => {
    let s = firstJourney();
    s = accept(s, { type: "abandon" });
    s = produce(s, (d) => {
      d.discovery.encountered = ["mossguard", "emberback", "prismram", "pollenmoth"];
      d.discovery.recruited = { mossguard: 1, emberback: 1, prismram: 1 };
      d.selected = ["mossguard"];
    });
    s = accept(s, { type: "newRun", seed: 24 });
    const initial = s;
    for (let round = 0; round < 3; round++) {
      expect(s.selected).toHaveLength(round);
      expect(s.starterOffers).toHaveLength(3 - round);
      expect(new Set(s.starterOffers)).toEqual(
        new Set(
          Object.keys(s.discovery.recruited).filter(
            (kind) => !s.selected.includes(kind as (typeof s.selected)[number]),
          ),
        ),
      );
      expect(dispatch(s, { type: "draft", species: "pollenmoth" }).state).toBe(s);
      expect(dispatch(s, { type: "start" }).state).toBe(s);
      s = decodeSave(encodeSave(s));
      s = accept(s, { type: "draft", species: s.starterOffers[0]! });
    }
    expect(s.starterOffers).toEqual([]);
    expect(new Set(s.selected)).toEqual(new Set(["mossguard", "emberback", "prismram"]));
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
    expect(s.starterOffers).toEqual([collected]);
    s = accept(decodeSave(encodeSave(s)), { type: "draft", species: collected });
    expect(dispatch(s, { type: "draft", species: collected }).accepted).toBe(false);
    expect(accept(s, { type: "start" }).team).toHaveLength(1);
  });

  it("includes both collected species when a later draft pool has fewer than three", () => {
    let s = firstJourney();
    s = accept(s, { type: "abandon" });
    s = produce(s, (d) => {
      d.discovery = { encountered: ["mossguard", "emberback"], recruited: { mossguard: 1, emberback: 1 } };
      d.selected = ["mossguard"];
    });
    s = accept(s, { type: "newRun", seed: 42 });
    expect(new Set(s.starterOffers)).toEqual(new Set(["mossguard", "emberback"]));
    expect(decodeSave(encodeSave(s))).toEqual(s);
    expect(() =>
      decodeSave(JSON.stringify({ ...s, starterOffers: ["mossguard", "mossguard", "mossguard"] })),
    ).toThrow();
  });

  it("rejects forged offers, uncollected selections and obsolete saves", () => {
    const s = createGame();
    for (const change of [
      { starterOffers: ["prismram"] },
      { selected: ["mossguard", "emberback"] },
      { starterOffers: [] },
      { version: 20 },
      { version: 21 },
      { version: 25 },
    ])
      expect(() => decodeSave(JSON.stringify({ ...s, ...change }))).toThrow();
    expect(createGame(7)).toEqual(createGame(7));
  });
});
