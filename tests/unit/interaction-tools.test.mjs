import { it, expect } from "vitest";
import { shrinkTrace, validateInteractionReport } from "../../scripts/lib/interaction-replay.mjs";
import { routeArguments, routes } from "../../scripts/lib/test-routes.mjs";
import { existsSync } from "node:fs";
it("shrinks only fresh valid replays of the same failure within its attempt budget", async () => {
  const trace = [{ kind: "collection" }, { kind: "settings" }, { kind: "battle" }, { kind: "reload" }];
  const replay = async (actions) => ({
    valid: actions.some((a) => a.kind === "battle"),
    failure: actions.some((a) => a.kind === "reload") ? "original" : "different",
  });
  const result = await shrinkTrace(trace, "original", replay);
  expect(result.actions).toEqual([{ kind: "battle" }, { kind: "reload" }]);
  const bounded = await shrinkTrace(trace, "original", replay, { attempts: 1 });
  expect(bounded.attempts).toBe(1);
  expect(bounded.bounded).toBe(true);
  const invalid = await shrinkTrace(trace, "original", async () => ({ valid: false, failure: "original" }));
  expect(invalid.actions).toEqual(trace);
});
it("rejects obsolete, malformed, and unbounded interaction traces", () => {
  const report = {
    format: 1,
    seed: 42,
    identity: "test",
    initial: "checkpoint",
    actions: [{ kind: "reload" }],
  };
  expect(validateInteractionReport(report)).toBe(report);
  for (const change of [
    { format: 0 },
    { seed: -1 },
    { actions: [] },
    { actions: Array(101).fill({ kind: "reload" }) },
    { actions: [{ kind: "battle" }] },
    { actions: [{ kind: "constructor" }] },
  ])
    expect(() => validateInteractionReport({ ...report, ...change })).toThrow();
});
it("named browser routes select existing files and reject arbitrary forwarding", () => {
  for (const [name, route] of Object.entries(routes)) {
    expect(route.files.every((file) => existsSync(file))).toBe(true);
    expect(routeArguments(name, ["--list"])).toContain(route.grep);
  }
  expect(() => routeArguments("constructor")).toThrow();
  expect(() => routeArguments("battle", ["--grep", "anything"])).toThrow();
});
