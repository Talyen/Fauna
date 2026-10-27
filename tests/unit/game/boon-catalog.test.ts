import { expect, it } from "vitest";
import { BOONS } from "../../../src/game/content";
import { validateContent } from "../../../src/game/content-validation";
import { CORNUCOPIA_CARD_ID, replenishJourneyCards } from "../../../src/game/journey-cards";
import { decodeSave, encodeSave } from "../../../src/game/save";
import prepared from "../../../src/assets/prepared.json";
import { NEW_BOON_EFFECTS } from "../../support/boons";
import { requireBattle, run } from "../../support/game";

it.each(Object.entries(NEW_BOON_EFFECTS))(
  "registers the approved %s effect, portrait and save identity",
  (id, text) => {
    const boon = BOONS.find((entry) => entry.id === id);
    expect(boon?.text).toBe(text);
    expect(Object.hasOwn(prepared.records, `boon.${id}`)).toBe(true);
    if (!boon) throw new Error(`Missing Boon: ${id}`);
    const state = requireBattle(structuredClone(run()));
    state.boons = [boon.id];
    if (boon.id === "cornucopia") {
      replenishJourneyCards(state);
      state.battle.draw.push(CORNUCOPIA_CARD_ID);
    }
    expect(decodeSave(encodeSave(state)).boons).toEqual([id]);
  },
);
it("validates the complete authored content catalog", () => {
  expect(validateContent).not.toThrow();
});
