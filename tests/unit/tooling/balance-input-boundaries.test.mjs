import { expect, it } from "vitest";
import { experimentConfigs } from "../../../scripts/balance/balance-compare.mjs";
import { compareBalance } from "../../../scripts/balance/paired-balance.mjs";
import { encodeSave } from "../../../src/game/save";
import { requireBattle, teamRun } from "../../support/game";

const loadouts = { baseline: { talents: [], boons: [] }, treatment: { talents: [], boons: [] } };
const metrics = { win: 1, turns: 4, health: 10, encounter: 1, swaps: 0, currency: -1, xp: 3 };
const report = () => ({
  format: 1,
  kind: "career",
  complete: true,
  identity: "source-a",
  settings: { policyVersion: 40 },
  cases: [{ key: "mossguard-42", complete: true, baseHash: "base", initialHash: "initial", metrics }],
});

it("prepares both experiment arms from a current battle checkpoint's deployed team", () => {
  const state = requireBattle(teamRun(42, ["mossguard"]));
  const checkpoint = encodeSave(state);
  const configs = experimentConfigs(checkpoint, loadouts);
  expect(configs.map((entry) => entry.arm)).toEqual(["baseline", "treatment"]);
  for (const entry of configs)
    expect(entry.config).toMatchObject({ checkpoint, seed: state.rng, starter: "mossguard" });
  expect(() => experimentConfigs(JSON.stringify({ ...state, phase: "draft" }), loadouts)).toThrow(
    "battle checkpoint",
  );
});

it("rejects malformed experiment loadouts before starting workers", () => {
  const checkpoint = encodeSave(requireBattle(teamRun(42, ["mossguard"])));
  for (const treatment of [{}, { talents: [], boons: "cornucopia" }, { talents: [""], boons: [] }])
    expect(() => experimentConfigs(checkpoint, { ...loadouts, treatment })).toThrow("ID arrays");
});

it("requires completed reports and cases before comparing outcomes", () => {
  const good = report();
  expect(compareBalance(good, good).metrics.currency.mean).toBe(0);
  expect(() => compareBalance({ ...good, complete: "true" }, good)).toThrow();
  expect(() => compareBalance({ ...good, failures: [{ reason: "watchdog" }] }, good)).toThrow();
  expect(() => compareBalance({ ...good, cases: [{ ...good.cases[0], complete: "true" }] }, good)).toThrow();
});

it("requires report identity, settings and matching checkpoint identities", () => {
  const good = report();
  expect(compareBalance(good, { ...good, identity: "source-b" }).codeChanged).toBe(true);
  for (const patch of [{ identity: "" }, { settings: undefined }, { kind: "unknown" }])
    expect(() => compareBalance({ ...good, ...patch }, { ...good, ...patch })).toThrow();
  for (const field of ["key", "baseHash", "initialHash"]) {
    const incomplete = { ...good, cases: [{ ...good.cases[0], [field]: "" }] };
    expect(() => compareBalance(incomplete, incomplete)).toThrow();
  }
  const experiment = { ...good, kind: "experiment" };
  const otherLoadout = { ...experiment, cases: [{ ...experiment.cases[0], initialHash: "different" }] };
  expect(compareBalance(experiment, otherLoadout).pairs).toHaveLength(1);
});

it("rejects impossible or fractional balance metrics while allowing spent Gold", () => {
  const good = report();
  for (const patch of [
    { win: 2 },
    { turns: 0 },
    { health: -1 },
    { encounter: -1 },
    { swaps: -1 },
    { xp: -1 },
    { turns: 1.5 },
  ]) {
    const invalid = { ...good, cases: [{ ...good.cases[0], metrics: { ...metrics, ...patch } }] };
    expect(() => compareBalance(invalid, invalid)).toThrow("Invalid metric");
  }
});
