import { describe, it } from "vitest";
import { expectSupportedLineup, ordinaryLineups } from "../support/lineups";
import { lineupShard } from "../../scripts/ci/unit-shards.mjs";

// Full CI retains every combination and every intermediate save boundary.
describe("all ordinary creature combinations", () => {
  for (const scenario of lineupShard(ordinaryLineups(), process.env.FAUNA_LINEUP_SHARD))
    it(`supports ${scenario.name} without engine failures or invalid saves`, () => {
      expectSupportedLineup(scenario);
    });
});
