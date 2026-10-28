import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { offerBoons, rosterBoonKeywords } from "../../../src/game/boon-offers";
import { BOONS } from "../../../src/game/content";
import { observeDecisions } from "../../../src/game/random";
import { starterJourney, teamRun } from "../../support/game";

describe("team-weighted Boon offers", () => {
  it("weights a matching Boon twice while leaving an unrelated Boon possible", () => {
    const state = starterJourney(42, "cindernewt");
    const pick = (decision: number) => {
      let offered: ReturnType<typeof offerBoons> = [];
      produce(state, (draft) => {
        draft.boons = BOONS.filter((boon) => boon.id !== "ember-platter" && boon.id !== "smugglers-map").map(
          (boon) => boon.id,
        );
        observeDecisions(draft, () => decision);
        offered = offerBoons(draft);
      });
      return offered;
    };
    // Smuggler's Map appears first in the catalog and occupies one third of the draw.
    expect(pick(0.32)[0]).toBe("smugglers-map");
    expect(pick(0.34)[0]).toBe("ember-platter");
    expect(new Set(pick(0.34))).toEqual(new Set(["ember-platter", "smugglers-map"]));
  });

  it("uses active and backup creatures' passives and abilities", () => {
    const state = teamRun(42, ["cindernewt", "pollenmoth"]);
    const roster = produce(state, (draft) => {
      draft.reserves.push(draft.team.pop()!);
      draft.discovery.recruited.pollenmoth = 1;
    });
    const keywords = rosterBoonKeywords(roster);
    expect([...keywords]).toEqual(expect.arrayContaining(["burn", "dodge", "light"]));
    expect(rosterBoonKeywords(starterJourney(42, "dawncall")).has("criticalHit")).toBe(true);
  });

  it("replays the same seeded offer and excludes owned Boons", () => {
    const state = starterJourney(23, "captoad");
    const draw = () => {
      let offered: ReturnType<typeof offerBoons> = [];
      const result = produce(state, (draft) => {
        draft.boons = ["ember-platter"];
        offered = offerBoons(draft);
      });
      return { offered, rng: result.rng };
    };
    const first = draw();
    expect(draw()).toEqual(first);
    expect(first.offered).toHaveLength(3);
    expect(new Set(first.offered).size).toBe(3);
    expect(first.offered).not.toContain("ember-platter");
  });
});
