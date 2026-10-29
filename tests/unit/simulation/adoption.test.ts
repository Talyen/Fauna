import { describe, expect, it } from "vitest";
import { produce } from "immer";
import { createDiagnostics } from "../../../src/application/diagnostics";
import { runJourney, type JourneyConfig } from "../../../src/tooling/playthrough";
import { teamRun } from "../../support/game";
import { decodeSave, encodeSave } from "../../../src/game/save";
import { contentCatalog, validateCatalog } from "../../../src/game/content-validation";
const config: JourneyConfig = {
  // Complete current-catalog journeys; arbitrary lineups may legitimately exhaust the turn budget.
  seed: 0,
  runs: 2,
  starter: "captoad",
  policy: "heuristic",
  maxActions: 2000,
  maxTurns: 100,
  resumeEvery: 7,
};
describe("headless production sessions", () => {
  it("returns home after a sustained stalled battle and replays the recorded outcome", async () => {
    const initial = produce(teamRun(42, ["bloomquail"]), (draft) => {
      draft.team[0]!.block = 1_000_000;
    });
    const settings = { ...config, runs: 1, resumeEvery: 1 };
    const journey = await runJourney(settings, "stall-fixture", encodeSave(initial));
    expect(journey.complete, journey.reason).toBe(true);
    expect(journey.results).toMatchObject([{ outcome: "returned" }]);
    expect(journey.battles).toMatchObject([{ outcome: "returned" }]);
    expect(journey.steps.at(-1)).toMatchObject({
      accepted: true,
      command: { type: "abandon" },
      decision: "Return home after ten turns without reaching a new low in enemy Health",
    });
    const ended = decodeSave(journey.steps.at(-1)!.checkpoint);
    expect(ended.journey!.outcome).toBe("returned");
    expect(ended.journey!.victories).toBe(initial.journey!.victories);
    const replay = await runJourney(
      { ...settings, resumeEvery: 0 },
      "stall-fixture",
      journey.initial,
      journey,
    );
    expect(replay.steps).toEqual(journey.steps);
    expect(replay.results).toEqual(journey.results);
    const bounded = await runJourney({ ...settings, maxTurns: 5 }, "stall-fixture", journey.initial);
    expect(bounded.complete).toBe(false);
    expect(bounded.reason).toBe("Turn budget exhausted");
    expect(bounded.results).toEqual([]);
  });
  // Several full simulations and checkpoint replays need headroom on shared hosted CPUs
  it(
    "replays journeys exactly across serialized save/resume without leaking policy randomness",
    async () => {
      const journey = await runJourney(config, "fixture");
      expect(journey.complete, journey.reason).toBe(true);
      expect(journey.steps.every((step) => step.accepted)).toBe(true);
      const replay = await runJourney({ ...config, resumeEvery: 1 }, "fixture", journey.initial, journey);
      expect(replay.steps).toEqual(journey.steps);
      const uninterrupted = await runJourney({ ...config, resumeEvery: 0 }, "fixture");
      expect(uninterrupted.steps).toEqual(journey.steps);
      const changed = structuredClone(journey);
      changed.steps[0]!.checkpoint = "corrupt";
      await expect(runJourney(config, "fixture", journey.initial, changed)).rejects.toThrow("diverged");
      await expect(runJourney(config, "different", journey.initial, journey)).rejects.toThrow("identity");
    },
    ciTimeout(30000),
  );
  it("retains decision reasons and live battle diagnostics when an action budget is exhausted", async () => {
    const checkpoint = teamRun(42, ["mossguard"]);
    const initial = encodeSave(checkpoint);
    const journey = await runJourney({ ...config, runs: 1, maxActions: 1 }, "fixture", initial);
    expect(journey.complete).toBe(false);
    expect(journey.results).toEqual([]);
    expect(journey.diagnostics).toMatchObject({ encounter: checkpoint.encounter, stalled: false });
    expect(journey.steps[0]!.decision.length).toBeGreaterThan(0);
    const replay = await runJourney(
      { ...config, runs: 1, maxActions: 1, resumeEvery: 1 },
      "fixture",
      initial,
      journey,
    );
    expect(replay.steps).toEqual(journey.steps);
    expect(replay.diagnostics).toEqual(journey.diagnostics);
  });
  it("reports exhausted budgets as incomplete", async () => {
    const journey = await runJourney({ ...config, maxActions: 2 }, "fixture");
    expect(journey.complete).toBe(false);
    expect(journey.results).toEqual([]);
  });
});
describe("local diagnostics", () => {
  it("bounds and deduplicates failures without collecting arbitrary context or breaking on persistence", () => {
    const diagnostics = createDiagnostics({
      read: () => null,
      write: () => {
        throw new Error("full");
      },
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    diagnostics.record("audio", circular);
    diagnostics.record("audio", circular);
    expect(diagnostics.snapshot()[0]!.count).toBe(2);
    diagnostics.record("save-write", new Error("/Users/person/private/save.json password=secret"), {
      revision: 3,
      phase: "battle",
    });
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain("person");
    expect(JSON.stringify(diagnostics.snapshot())).not.toContain("password=secret");
    for (let index = 0; index < 100; index++) diagnostics.record("global", `failure ${index}`);
    expect(diagnostics.snapshot()).toHaveLength(50);
    diagnostics.dispose();
    diagnostics.record("audio", "late");
    expect(diagnostics.snapshot().some((entry) => entry.message === "late")).toBe(false);
  });
});
describe("authored content", () => {
  it("reports broken ownership, values, IDs, packs, and prerequisites by field", () => {
    expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
    const catalog = structuredClone(contentCatalog);
    Object.assign(catalog.cards[0]!, { species: "missing", value: NaN, cost: 100 });
    Object.assign(catalog.talents[0]!, { row: 9 });
    const issues = validateCatalog(catalog);
    expect(issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["species", "value", "cost", "row"]),
    );
  });
});

function ciTimeout(ms: number) {
  return process.env.CI ? 0 : ms;
}
