import { describe, it } from "vitest";
import { expectSupportedLineup, ordinaryLineups } from "../support/lineups";

// Full CI retains every combination and every intermediate save boundary.
describe("all ordinary creature combinations", () => {
  for (const scenario of ordinaryLineups())
    it(`supports ${scenario.name} without engine failures or invalid saves`, () => {
      expectSupportedLineup(scenario);
    });
});
