import { expect, it } from "vitest";
import { boundaryViolations } from "../../scripts/boundaries.mjs";
it("resolves imports and reexports and rejects computed gameplay module access", () => {
  for (const source of [
    'export * from "../ui/App"',
    'import("@/ui/App")',
    'require("node:fs")',
    'import("./../../src/ui/App")',
    "import(name)",
  ])
    expect(boundaryViolations("src/game/fixture.ts", source).length).toBeGreaterThan(0);
  expect(
    boundaryViolations(
      "src/game/fixture.ts",
      'import {produce} from "immer"; export type {GameState} from "./types";',
    ),
  ).toEqual([]);
});
it("distinguishes references from strings, properties and local bindings", () => {
  expect(
    boundaryViolations(
      "src/game/fixture.ts",
      'const text="Date.now window"; const record={window: 1}; function f(window:number){return window};',
    ),
  ).toEqual([]);
  for (const source of ["Date.now()", 'Math["random"]()', 'fetch("x")', "window.localStorage"])
    expect(boundaryViolations("src/game/fixture.ts", source).length).toBeGreaterThan(0);
});
it("protects application, platform, and UI boundaries", () => {
  expect(boundaryViolations("src/application/a.ts", 'import React from "react"').length).toBeGreaterThan(0);
  expect(
    boundaryViolations("src/platform/a.ts", 'import {dispatch} from "../game/engine"').length,
  ).toBeGreaterThan(0);
  expect(boundaryViolations("src/ui/a.ts", 'localStorage.setItem("save", data)').length).toBeGreaterThan(0);
});
