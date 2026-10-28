import { expect, it } from "vitest";
import { modifierContractViolations } from "../../../scripts/checks/modifier-contracts.mjs";

const fixture = () => ({
  "src/game/content/talents/water.ts": 'export const talents = [{id: "water.pressure"}];',
  "src/game/content/boons.ts": 'export const boons = [{id: "icy-heart"}];',
  "src/game/content/types.ts": 'type PassiveEffect = {kind: "wellRead"; amount: number};',
  "src/game/owner.ts": `
    import {hasTalent} from "./progression";
    export function hit(state) { if (hasTalent(state, "water.pressure")) state.damage++;
      if (state.boons.includes("icy-heart")) state.damage += 6; }
    export function copy(effect) { return effect.kind === "wellRead" ? effect.amount : 0; }
  `,
  "src/game/entry.ts":
    'import {hit as applyHit, copy} from "./owner"; export function command(state) { applyHit(state); copy(state.effect); }',
  "src/game/modifier-bindings.ts": `
    export const modifierImplementations = freeze({
      talents: {"water.pressure": ["./owner#hit"]}, boons: {"icy-heart": ["./owner#hit"]}, passives: {wellRead: ["./owner#copy"]}
    }, true);
    export const modifierQueries = freeze({talents: {}, boons: {}, passives: {}}, true);
  `,
});

it("accepts actual named implementations with aliased runtime callers", () => {
  expect(modifierContractViolations(fixture())).toEqual([]);
});

it.each([
  '"./owner"',
  '"./owner#"',
  '"#hit"',
  '"owner#hit"',
  '"./owner#hit#extra"',
  '{module: "./owner", name: "hit"}',
  'reference("./owner", "hit")',
  "...references",
])("rejects a nonliteral or malformed implementation reference: %s", (reference) => {
  const sources = fixture();
  sources["src/game/modifier-bindings.ts"] = sources["src/game/modifier-bindings.ts"].replace(
    '["./owner#hit"]',
    `[${reference}]`,
  );
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("water.pressure must bind typed module/export references"),
  );
});

it("follows aliased pure parameter consumers through their declared query bindings", () => {
  const sources = fixture();
  sources["src/game/extra.ts"] =
    'import {talentRule as rule} from "./rules/talents"; export function estimate(){return rule("water.pressure").amount}';
  sources["src/game/entry.ts"] += 'import {estimate} from "./extra"; estimate();';
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("has an undeclared owner: src/game/extra.ts#estimate"),
  );
  sources["src/game/modifier-bindings.ts"] = sources["src/game/modifier-bindings.ts"].replace(
    "talents: {}, boons: {}, passives: {}",
    'talents: {"water.pressure":["./extra#estimate"]}, boons: {}, passives: {}',
  );
  expect(modifierContractViolations(sources)).toEqual([]);
});
it("rejects a new authored modifier without an implementation binding", () => {
  const sources = fixture();
  sources["src/game/content/talents/water.ts"] += 'export const added = {id: "water.future"};';
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("Missing talents implementation: water.future"),
  );
});
it("checks built Talent identities through imported aliases without treating copy as an identity", () => {
  const sources = fixture();
  sources["src/game/content/talents/water.ts"] = `
    import {talent as define} from "../talent-builder";
    export const talents = [define("water.pressure", "Pressure", 0, "water.copy")];
  `;
  expect(modifierContractViolations(sources)).toEqual([]);
  sources["src/game/content/talents/water.ts"] += 'define("water.future", "Future", 1, "Future rule");';
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("Missing talents implementation: water.future"),
  );
});
it("rejects a binding to an existing function that does not implement the modifier", () => {
  const sources = fixture();
  sources["src/game/modifier-bindings.ts"] = sources["src/game/modifier-bindings.ts"].replace(
    '"water.pressure": ["./owner#hit"]',
    '"water.pressure": ["./owner#copy"]',
  );
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("water.pressure is not implemented/read by src/game/owner.ts#copy"),
  );
});
it("rejects an implementation that was removed or disconnected from runtime", () => {
  const sources = fixture();
  sources["src/game/entry.ts"] = "export function command() {}";
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("which has no runtime caller"),
  );
  delete sources["src/game/owner.ts"];
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("binds a missing implementation"),
  );
});
it("rejects undeclared duplicate interpretations of an existing rule", () => {
  const sources = fixture();
  sources["src/game/extra.ts"] =
    'import {hasTalent} from "./progression"; export function extra(state) { return hasTalent(state, "water.pressure"); }';
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("has an undeclared owner: src/game/extra.ts#extra"),
  );
});
it("requires read-only interpretations to be declared separately", () => {
  const sources = fixture();
  sources["src/game/extra.ts"] =
    'import {hasTalent} from "./progression"; export function estimate(state) { return hasTalent(state, "water.pressure"); }';
  sources["src/game/entry.ts"] += 'import {estimate} from "./extra"; estimate({});';
  sources["src/game/modifier-bindings.ts"] = sources["src/game/modifier-bindings.ts"].replace(
    "talents: {}, boons: {}, passives: {}",
    'talents: {"water.pressure": ["./extra#estimate"]}, boons: {}, passives: {}',
  );
  expect(modifierContractViolations(sources)).toEqual([]);
});
it("recognizes the existing scheduler dispatch without accepting a registration-only reference", () => {
  const sources = fixture();
  sources["src/game/entry.ts"] = 'import {copy} from "./owner"; copy({});';
  sources["src/game/combat/resolution.ts"] = 'import {hit} from "../owner"; const handlers = {hit};';
  expect(modifierContractViolations(sources)).toEqual([]);
  delete sources["src/game/combat/resolution.ts"];
  expect(modifierContractViolations(sources).length).toBeGreaterThan(0);
});
it("rejects unknown, duplicate and empty bindings", () => {
  for (const replacement of [
    '"water.future": ["./owner#hit"]',
    '"water.pressure": []',
    '"water.pressure": ["./owner#hit"], "water.pressure": ["./owner#hit"]',
  ]) {
    const sources = fixture();
    sources["src/game/modifier-bindings.ts"] = sources["src/game/modifier-bindings.ts"].replace(
      '"water.pressure": ["./owner#hit"]',
      replacement,
    );
    expect(modifierContractViolations(sources).length).toBeGreaterThan(0);
  }
});
it("ignores comments, descriptive strings outside functions and operation names", () => {
  const sources = fixture();
  sources["src/game/entry.ts"] += `
    // hasTalent(state, "water.pressure")
    const label = "water.pressure";
    function operation() { return reaction("wellRead"); }
  `;
  expect(modifierContractViolations(sources)).toEqual([]);
});

it("rejects a function that only mentions the identity without selecting the rule", () => {
  const sources = fixture();
  sources["src/game/owner.ts"] = sources["src/game/owner.ts"].replace(
    'if (hasTalent(state, "water.pressure")) state.damage++;',
    'const label = "water.pressure";',
  );
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("water.pressure is not implemented/read by"),
  );
});

it("does not mistake another content discriminant for a supported passive kind", () => {
  const sources = fixture();
  sources["src/game/content/types.ts"] += 'type Unrelated = {kind: "unrelated"};';
  expect(modifierContractViolations(sources)).toEqual([]);
});

it("tracks aliased Talent chance and passive queries at their calling owners", () => {
  const sources = fixture();
  sources["src/game/owner.ts"] = `
    import {talentChance as proc} from "./chance";
    import {passiveAmount as amount} from "./progression";
    export function hit(state) {
      if (proc(state, "water.pressure", [])) state.damage++;
      if (state.boons.includes("icy-heart")) state.damage += 6;
    }
    export function copy(state) { return amount(state, "mossguard", "wellRead"); }
  `;
  expect(modifierContractViolations(sources)).toEqual([]);
  sources["src/game/owner.ts"] = sources["src/game/owner.ts"].replace(
    'amount(state, "mossguard", "wellRead")',
    'amount(state, "wellRead", "other")',
  );
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("wellRead is not implemented/read by"),
  );
});

it("tracks a Boon saved-state consumer without requiring the Boon to remain owned", () => {
  const sources = fixture();
  sources["src/game/extra.ts"] =
    'import {boonRule as rule} from "./rules/boons"; export function consume(stats) { stats[rule("icy-heart").state] = false; }';
  sources["src/game/entry.ts"] += 'import {consume} from "./extra"; consume({});';
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("has an undeclared owner: src/game/extra.ts#consume"),
  );
  sources["src/game/modifier-bindings.ts"] = sources["src/game/modifier-bindings.ts"].replace(
    '"icy-heart": ["./owner#hit"]',
    '"icy-heart": ["./owner#hit", "./extra#consume"]',
  );
  expect(modifierContractViolations(sources)).toEqual([]);
  sources["src/game/extra.ts"] = sources["src/game/extra.ts"].replace(".state", ".amount");
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("icy-heart is not implemented/read by src/game/extra.ts#consume"),
  );
});

it("follows namespace exports only when spread into the scheduler's handler registry", () => {
  const sources = fixture();
  sources["src/game/entry.ts"] = "export function command() {}";
  sources["src/game/combat/resolution.ts"] =
    'import * as operations from "../owner"; const handlers = {...operations};';
  expect(modifierContractViolations(sources)).toEqual([]);
  sources["src/game/combat/resolution.ts"] =
    'import * as operations from "../owner"; const unused = {...operations};';
  expect(modifierContractViolations(sources)).toContainEqual(
    expect.stringContaining("which has no runtime caller"),
  );
});
