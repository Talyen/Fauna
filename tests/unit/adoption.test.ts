import { describe, expect, it } from "vitest";
import { createDiagnostics } from "../../src/application/diagnostics";
import { runJourney, type JourneyConfig } from "../../src/application/playthrough";
import { contentCatalog, validateCatalog } from "../../src/game/content-validation";
const config: JourneyConfig = {
  seed: 42,
  runs: 2,
  starter: "emberback",
  policy: "heuristic",
  maxActions: 2000,
  maxTurns: 100,
  resumeEvery: 7,
};
describe("headless production sessions", () => {
  it("replays journeys exactly across serialized save/resume without leaking policy randomness", async () => {
    const journey = await runJourney(config, "fixture");
    expect(journey.complete).toBe(true);
    expect(journey.steps.every((step) => step.accepted)).toBe(true);
    const replay = await runJourney({ ...config, resumeEvery: 1 }, "fixture", journey.initial, journey);
    expect(replay.steps).toEqual(journey.steps);
    const uninterrupted = await runJourney({ ...config, resumeEvery: 0 }, "fixture");
    expect(uninterrupted.steps).toEqual(journey.steps);
    const changed = structuredClone(journey);
    changed.steps[0]!.checkpoint = "corrupt";
    await expect(runJourney(config, "fixture", journey.initial, changed)).rejects.toThrow("diverged");
    await expect(runJourney(config, "different", journey.initial, journey)).rejects.toThrow("identity");
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
