import { describe, it } from "vitest";
import { expectSupportedLineup, ordinaryLineups } from "../../support/lineups";

describe("every ordinary three-creature lineup", () => {
  for (const scenario of ordinaryLineups())
    it(`supports ${scenario.name} without engine failures or invalid saves`, () => {
      expectSupportedLineup(scenario);
    });
});
