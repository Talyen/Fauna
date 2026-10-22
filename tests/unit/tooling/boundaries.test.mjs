import { expect, it } from "vitest";
import { boundaryViolations } from "../../../scripts/checks/boundaries.mjs";
it("resolves imports and reexports and rejects computed gameplay module access", () => {
  for (const source of [
    'export * from "../ui/App"',
    'import("@/ui/App")',
    'require("node:fs")',
    'import("../../src/ui/App")',
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

it("keeps development harnesses outside runtime dependencies and presentation", () => {
  for (const file of [
    "src/application/a.ts",
    "src/platform/a.ts",
    "src/ui/battle/a.ts",
    "src/components/a.ts",
    "src/lib/a.ts",
    "src/main.tsx",
  ]) {
    expect(boundaryViolations(file, 'import {runJourney} from "@/tooling/playthrough"')).toHaveLength(1);
  }
  for (const source of [
    'import React from "react"',
    'import {App} from "../ui/App"',
    'import fs from "node:fs"',
  ]) {
    expect(boundaryViolations("src/tooling/a.ts", source)).toHaveLength(1);
  }
  expect(
    boundaryViolations("src/tooling/a.ts", 'import {createSession} from "../application/session"'),
  ).toEqual([]);
});

it("prevents utilities and presentation foundations from bypassing feature and privileged boundaries", () => {
  for (const file of ["src/lib/a.ts", "src/ui/infrastructure/a.ts", "src/components/ui/a.tsx"]) {
    for (const source of [
      'import {dispatch} from "@/game/engine"',
      'export * from "@/application/session"',
      'import("@/platform/browser")',
      'import {App} from "@/ui/App"',
      'import fs from "node:fs"',
    ])
      expect(boundaryViolations(file, source).length).toBeGreaterThan(0);
  }
  expect(boundaryViolations("src/lib/a.ts", 'import React from "react"').length).toBeGreaterThan(0);
  expect(
    boundaryViolations("src/ui/infrastructure/a.ts", 'import {Button} from "@/components/ui/button"').length,
  ).toBeGreaterThan(0);
  expect(
    boundaryViolations(
      "src/components/ui/a.tsx",
      'import {useSurfaceRef} from "@/ui/infrastructure/surface-ref"',
    ),
  ).toEqual([]);
  expect(boundaryViolations("src/lib/a.ts", 'import {clsx} from "clsx"')).toEqual([]);
});

it("keeps the shared ability executor behind application commands", () => {
  for (const source of [
    'import {executeAbility as run} from "../../game/abilities"',
    'import * as abilities from "@/game/abilities"',
    'import("@/game/abilities.ts")',
  ])
    expect(boundaryViolations("src/ui/battle/fixture.ts", source)).toEqual([
      "src/ui/battle/fixture.ts: UI must use application commands and read-only previews.",
    ]);
  expect(
    boundaryViolations("src/ui/battle/fixture.ts", 'import {previewPlay} from "../../game/preview"'),
  ).toEqual([]);
});

it("keeps shared presentation independent of feature compositions", () => {
  for (const source of [
    'import {CombatStatus} from "../battle/combat-status"',
    'export * from "@/ui/collection/collection"',
    'import("@/ui/battle/target-preview")',
  ])
    expect(boundaryViolations("src/ui/shared/fixture.tsx", source)).toEqual([
      "src/ui/shared/fixture.tsx: Shared presentation cannot import feature owners.",
    ]);
  expect(
    boundaryViolations(
      "src/ui/shared/fixture.tsx",
      'import {CombatStatus} from "./combat-status"; import {useSurfaceRef} from "../infrastructure/surface-ref";',
    ),
  ).toEqual([]);
});

it("keeps combat continuations below public entry points and outside presentation", () => {
  expect(
    boundaryViolations("src/ui/battle/fixture.ts", 'import {resolveCombat} from "@/game/combat-resolution"'),
  ).toHaveLength(1);
  for (const file of [
    "src/game/combat-state.ts",
    "src/game/combat-policy.ts",
    "src/game/combat-resolution.ts",
  ])
    for (const target of ["./combat", "@/game/engine", "./abilities.ts"])
      expect(boundaryViolations(file, `import * as higher from "${target}"`)).toHaveLength(1);
  for (const file of ["src/game/combat-state.ts", "src/game/combat-policy.ts"])
    expect(boundaryViolations(file, 'export * from "./combat-resolution"')).toHaveLength(1);
  expect(
    boundaryViolations("src/game/combat.ts", 'import {resolveCombat} from "./combat-resolution"'),
  ).toEqual([]);
  expect(
    boundaryViolations("src/game/combat-resolution.ts", 'import {removeArmor} from "./combat-state"'),
  ).toEqual([]);
});
