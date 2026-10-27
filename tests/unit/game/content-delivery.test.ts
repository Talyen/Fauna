import { expect, it } from "vitest";
import { contentCatalog, validateCatalog } from "../../../src/game/content-validation";
import type { SupplementalEffect } from "../../../src/game/rules/ability-types";

it("accepts all current authored delivery and passive limits", () => {
  expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
});

it("rejects an ability owned by an unknown species", () => {
  const catalog = structuredClone(contentCatalog);
  const card = catalog.cards.find((entry) => entry.id === "mossguard-guard")!;
  Object.assign(card, { species: "unknown-species" });
  expect(validateCatalog(catalog)).toContainEqual(
    expect.objectContaining({ id: card.id, field: "species", message: "Unknown owner.", severity: "error" }),
  );
});

it.each([
  ["mossguard-guard", "self", false],
  ["mossguard-guard", "injured", true],
  ["mossguard-heal", "injured", false],
  ["mossguard-heal", "randomEnemy", true],
  ["bloomquail-draw", "self", true],
] as const)("validates the authored target %s / %s", (id, target, invalid) => {
  const catalog = structuredClone(contentCatalog);
  const card = catalog.cards.find((entry) => entry.id === id)!;
  // Exercise runtime validation with external data, including targets the type rejects.
  Object.assign(card, { target });
  const issues = validateCatalog(catalog).filter((issue) => issue.id === id && issue.field === "target");
  expect(issues.length > 0).toBe(invalid);
});

it.each([
  ["mossguard", "blockRetention", 101],
  ["oathara", "unfinishedJourney", 7],
] as const)("rejects %s passive values that exceed runtime and save limits", (id, kind, amount) => {
  const catalog = structuredClone(contentCatalog);
  catalog.species.find((entry) => entry.id === id)!.passiveTiers[0].effects = [{ kind, amount }];
  expect(validateCatalog(catalog)).toContainEqual(
    expect.objectContaining({ id, field: "passiveTiers", severity: "error" }),
  );
});

it.each([
  { kind: "heal", amount: 2, target: "recipient" },
  { kind: "cleanse", amount: 1, target: "recipient" },
] satisfies SupplementalEffect[])("rejects an undelivered recipient-only $kind on a guard", (effect) => {
  const catalog = structuredClone(contentCatalog);
  const card = catalog.cards.find((entry) => entry.id === "mossguard-guard")!;
  card.effects = [effect];
  expect(validateCatalog(catalog)).toContainEqual(
    expect.objectContaining({ id: card.id, field: "effects", severity: "error" }),
  );
});

it.each([
  { kind: "damage", amount: 2, damageType: "water" },
  { kind: "purge", amount: 1 },
] satisfies SupplementalEffect[])("rejects $kind without an individual opposing recipient", (effect) => {
  for (const id of ["mossguard-guard", "emberback-furnace-breath"]) {
    const catalog = structuredClone(contentCatalog);
    const card = catalog.cards.find((entry) => entry.id === id)!;
    card.effects = [effect];
    expect(validateCatalog(catalog)).toContainEqual(
      expect.objectContaining({ id, field: "effects", severity: "error" }),
    );
  }
});
