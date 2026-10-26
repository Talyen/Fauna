import { expect, it } from "vitest";
import { contentCatalog, validateCatalog } from "../../../src/game/content-validation";
import type { SupplementalEffect } from "../../../src/game/rules/ability-types";

it("accepts all current authored delivery and passive limits", () => {
  expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
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
