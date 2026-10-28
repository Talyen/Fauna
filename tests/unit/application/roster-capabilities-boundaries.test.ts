import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { capabilities } from "../../../src/application/team-policy";
import { offerBoons, rosterBoonKeywords } from "../../../src/game/boon-offers";
import { BOONS, type BoonId, type SpeciesId } from "../../../src/game/content";
import { observeDecisions } from "../../../src/game/random";
import { starterJourney } from "../../support/game";

function firstOffer(kind: SpeciesId, target: BoonId) {
  let first: BoonId | undefined;
  produce(starterJourney(42, kind), (state) => {
    state.boons = BOONS.filter((boon) => boon.id !== "smugglers-map" && boon.id !== target).map(
      (boon) => boon.id,
    );
    observeDecisions(state, () => 0.4);
    first = offerBoons(state)[0];
  });
  return first;
}

describe("roster capability boundaries", () => {
  it("recognizes Memento's Water damage when weighting Boon offers", () => {
    expect(rosterBoonKeywords(starterJourney(42, "memento")).has("water")).toBe(true);
    expect(firstOffer("memento", "rain-cape")).toBe("rain-cape");
  });

  it("recognizes Euphera's Purge when weighting Boon offers", () => {
    expect(rosterBoonKeywords(starterJourney(42, "euphera")).has("purge")).toBe(true);
    expect(firstOffer("euphera", "pattern-reel")).toBe("pattern-reel");
  });

  it("recognizes the Thorns affected by Euphera's Purge", () => {
    expect(rosterBoonKeywords(starterJourney(42, "euphera")).has("thorns")).toBe(true);
    expect(firstOffer("euphera", "treaty-teapot")).toBe("treaty-teapot");
  });

  it("recognizes Aerostat's Blind removal in replacement coverage", () => {
    const state = starterJourney(42, "aerostat");
    expect(capabilities(state, ["aerostat"]).has("cleanse")).toBe(true);
  });

  it("recognizes Stillara's Freeze removal in replacement coverage", () => {
    const state = starterJourney(42, "stillara");
    expect(capabilities(state, ["stillara"]).has("cleanse")).toBe(true);
  });
});
