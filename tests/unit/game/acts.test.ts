import { encounterPacks } from "../../support/encounter-packs";
import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { decodeSave, encodeSave } from "../../../src/game/save";
import {
  generateEncounterPack,
  bossEncounter,
  finalEncounter,
  JOURNEY_LENGTH,
} from "../../../src/game/encounters";
import { observeDecisions } from "../../../src/game/random";
import type { GameState } from "../../../src/game/types";
import {
  accept,
  completeRecruitment,
  merchantDestination,
  prepareDestination,
  starterJourney,
  winBattle,
} from "../../support/game";

describe("three-act journey", () => {
  it("draws every eligible Legendary in every Boss room", () => {
    for (const encounter of [9, 19, 29]) {
      const found = new Set<string>();
      for (const roll of [0.1, 0.35, 0.6, 0.9]) {
        const state = produce(starterJourney(42, "mossguard"), (draft) => {
          draft.encounter = encounter;
          observeDecisions(draft, () => roll);
          found.add(generateEncounterPack(draft)[0]!);
        });
        expect(bossEncounter(state)).toBe(true);
      }
      expect([...found].sort()).toEqual(["chronora", "memento", "tithemaw", "velvetmonarch"]);
      expect(encounterPacks(encounter)).toHaveLength(4);
    }
    const choices = new Set<string>();
    for (const roll of [0.1, 0.5, 0.9])
      produce(starterJourney(42, "memento"), (draft) => {
        draft.encounter = 9;
        observeDecisions(draft, () => roll);
        choices.add(generateEncounterPack(draft)[0]!);
      });
    expect([...choices].sort()).toEqual(["chronora", "tithemaw", "velvetmonarch"]);
    expect(JOURNEY_LENGTH).toBe(30);
  });

  it("counts a Recruit and Campfire but not canceling the Campfire", () => {
    let state = produce(starterJourney(42, "mossguard"), (draft) => {
      draft.expedition.recruit = "captoad";
      draft.team[0]!.health = 1;
    });
    state = accept(state, { type: "recruitDestination", species: "captoad" });
    expect(state.encounter).toBe(1);
    expect(state.journey!.victories).toBe(0);
    expect(decodeSave(encodeSave(state))).toEqual(state);
    state = accept(state, { type: "visitCampfire" });
    const canceled = accept(state, { type: "leaveCampfire" });
    expect(canceled.encounter).toBe(1);
    state = produce(canceled, (draft) => {
      draft.expedition.lastRoom = "combat";
    });
    state = accept(accept(state, { type: "visitCampfire" }), { type: "rest" });
    expect(state.encounter).toBe(2);
    expect(state.team[0]!.health).toBeGreaterThan(1);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it("counts a purchased Merchant once after resume but not a canceled visit", () => {
    let state: GameState = merchantDestination();
    const startingRoom = state.encounter;
    const visit = state.support!;
    const entered = accept(state, { type: "enterSupport", visit: visit.id });
    const canceled = accept(entered, { type: "leaveSupport", visit: visit.id });
    expect(canceled.encounter).toBe(state.encounter);
    const slot = visit.stock.find((item) => item.price <= state.currency)!;
    state = accept(entered, { type: "buyBoon", visit: visit.id, slot: slot.slot });
    state = decodeSave(encodeSave(state));
    state = accept(state, { type: "leaveSupport", visit: visit.id });
    expect(state.encounter).toBe(startingRoom + 1);
    expect(state.boons).toContain(slot.boon);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it.each([9, 19])("makes room %s a mandatory Boss and advances after its rewards", (bossRoom) => {
    let state = produce(starterJourney(42, "mossguard"), (draft) => {
      draft.encounter = bossRoom - 1;
      draft.journey!.victories = Math.floor(bossRoom / 10);
      draft.expedition.recruit = "captoad";
      draft.expedition.pack = ["emberback", "pollenmoth", "mossguard"];
    });
    state = accept(state, { type: "recruitDestination", species: "captoad" });
    expect(state.encounter).toBe(bossRoom);
    expect(bossEncounter(state)).toBe(true);
    expect(state.support).toBeNull();
    expect(state.expedition.recruit).toBeNull();
    expect(decodeSave(encodeSave(state))).toEqual(state);
    state = winBattle(accept(state, { type: "beginBattle" }));
    state = completeRecruitment(state);
    if (state.phase === "boon") state = accept(state, { type: "skipBoon" });
    expect(state.encounter).toBe(bossRoom + 1);
    expect(state.journey!.victories).toBe(Math.floor(bossRoom / 10) + 1);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it("retains the last battle receipt through later completed support rooms", () => {
    let state = starterJourney(42, "mossguard");
    state = completeRecruitment(winBattle(accept(state, { type: "beginBattle" })));
    const receipt = state.journey!.lastBattle;
    state = produce(state, (draft) => {
      draft.expedition.recruit = "captoad";
      draft.team[0]!.health = 1;
    });
    state = accept(state, { type: "recruitDestination", species: "captoad" });
    state = accept(accept(state, { type: "visitCampfire" }), { type: "rest" });
    expect(state.journey!.lastBattle).toEqual(receipt);
    expect(state.journey!.victories).toBe(1);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });

  it("only completes the Journey after the third Boss", () => {
    let state = produce(starterJourney(42, "mossguard"), (draft) => {
      draft.encounter = 29;
      prepareDestination(draft);
      draft.journey!.victories = 2;
      draft.expedition.pack = generateEncounterPack(draft);
      draft.expedition.recruit = null;
      draft.support = null;
    });
    expect(finalEncounter(state)).toBe(true);
    state = winBattle(accept(state, { type: "beginBattle" }));
    state = completeRecruitment(state);
    expect(state.phase).toBe("victory");
    expect(state.journey!.victories).toBe(3);
    expect(decodeSave(encodeSave(state))).toEqual(state);
  });
});
