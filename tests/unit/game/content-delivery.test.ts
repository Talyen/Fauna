import { PROGRESSION_KEYWORDS } from "../../../src/game/keywords";
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

it("reports malformed supplemental containers and entries without aborting the catalog audit", () => {
  for (const effects of [{ kind: "heal", amount: 2 }, [null], Array(1), ["damage"]]) {
    const catalog = structuredClone(contentCatalog);
    const card = catalog.cards.find((entry) => entry.id === "mossguard-guard")!;
    Object.assign(card, { effects });
    const issues = validateCatalog(catalog);
    expect(issues).toContainEqual(
      expect.objectContaining({ id: card.id, field: "effects", severity: "error" }),
    );
  }
});

it("rejects non-boolean ability switches and false enabled-only flags", () => {
  for (const field of [
    "draw",
    "backupOnly",
    "restore",
    "doubleAgainstHealthier",
    "criticalWhenLastCard",
    "purgeThorns",
    "allyOnly",
  ]) {
    for (const value of ["true", 1, false]) {
      const catalog = structuredClone(contentCatalog);
      const card = catalog.cards.find((entry) => entry.effect === "attack")!;
      Object.assign(card, { [field]: value });
      expect(validateCatalog(catalog)).toContainEqual(
        expect.objectContaining({ id: card.id, field: "tags", severity: "error" }),
      );
    }
  }
  const catalog = structuredClone(contentCatalog);
  const card = catalog.cards.find((entry) => entry.effect === "attack")!;
  Object.assign(card, { doubleWithArmor: "false" });
  expect(validateCatalog(catalog)).toContainEqual(
    expect.objectContaining({ id: card.id, field: "tags", severity: "error" }),
  );
});

it("rejects truthy non-boolean supplemental Leech", () => {
  const catalog = structuredClone(contentCatalog);
  const card = catalog.cards.find((entry) => entry.effect === "attack" && entry.target === undefined)!;
  Object.assign(card, { effects: [{ kind: "damage", amount: 2, damageType: "water", leech: "false" }] });
  expect(validateCatalog(catalog)).toContainEqual(
    expect.objectContaining({ id: card.id, field: "effects", message: "Supplemental Leech must be boolean" }),
  );
});

it("requires a real Legendary marker rather than a truthy string or false property", () => {
  for (const legendary of ["false", 1, false]) {
    const catalog = structuredClone(contentCatalog);
    Object.assign(catalog.species[0]!, { legendary });
    expect(validateCatalog(catalog)).toContainEqual(
      expect.objectContaining({ id: catalog.species[0]!.id, field: "legendary", severity: "error" }),
    );
  }
});

it("rejects sparse encounter packs instead of counting holes as authored opponents", () => {
  const catalog = structuredClone(contentCatalog);
  Object.assign(catalog, { combatPacks: [Array(1)] });
  expect(validateCatalog(catalog)).toContainEqual(
    expect.objectContaining({ id: "encounters", field: "packs", severity: "error" }),
  );
});

it("keeps passive aggregate limits additive across separate effects", () => {
  const catalog = structuredClone(contentCatalog);
  catalog.species[0]!.passiveTiers[0].effects = [
    { kind: "blockRetention", amount: 60 },
    { kind: "blockRetention", amount: 60 },
    { kind: "unfinishedJourney", amount: 4 },
    { kind: "unfinishedJourney", amount: 4 },
  ];
  const issues = validateCatalog(catalog);
  expect(issues).toContainEqual(
    expect.objectContaining({ message: "Block retention cannot create Block during decay" }),
  );
  expect(issues).toContainEqual(
    expect.objectContaining({ message: "Borrowed-card allowance exceeds the supported saved counter" }),
  );
});

it("rebuilds keyword availability for each catalog rather than retaining a previous audit", () => {
  const empty = structuredClone(contentCatalog);
  Object.assign(empty, { cards: [] });
  expect(
    validateCatalog(empty)
      .filter((issue) => issue.field === "availability")
      .map((issue) => issue.id),
  ).toEqual(PROGRESSION_KEYWORDS);
  expect(validateCatalog().filter((issue) => issue.severity === "error")).toEqual([]);
  expect(validateCatalog(empty).filter((issue) => issue.field === "availability")).toHaveLength(
    PROGRESSION_KEYWORDS.length,
  );
});

it("does not use another keyword's Talent row to fill a missing prerequisite row", () => {
  const catalog = structuredClone(contentCatalog);
  const talent = catalog.talents.find((entry) => entry.row > 0)!;
  Object.assign(catalog, {
    talents: catalog.talents.filter(
      (entry) => entry.keyword !== talent.keyword || entry.row !== talent.row - 1,
    ),
  });
  expect(validateCatalog(catalog)).toContainEqual(
    expect.objectContaining({ id: talent.id, field: "row", message: "Talent rows must be contiguous." }),
  );
});

it("reports independent catalog errors in validation order", () => {
  const catalog = structuredClone(contentCatalog);
  const [species] = catalog.species;
  const [card] = catalog.cards;
  const [boss] = catalog.bosses;
  const [talent] = catalog.talents;
  const [boon] = catalog.boons;
  Object.assign(species!, { health: 0 });
  Object.assign(card!, { cost: 2 });
  Object.assign(boss!, { encounter: -1 });
  Object.assign(talent!, { row: -1 });
  Object.assign(boon!, { name: "" });
  const expected = [
    [species!.id, "health"],
    [card!.id, "cost"],
    [boss!.id, "encounter"],
    [talent!.id, "row"],
    [boon!.id, "description"],
  ];
  const issues = validateCatalog(catalog)
    .filter((issue) => expected.some(([id, field]) => issue.id === id && issue.field === field))
    .map(({ id, field }) => [id, field]);
  expect(issues).toEqual(expected);
});
