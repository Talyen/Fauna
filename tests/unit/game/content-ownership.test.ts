import { expect, it } from "vitest";
import {
  CARDS,
  SPECIES,
  definition,
  species,
  FIRST_RUN_STARTERS,
  BOONS,
  TALENTS,
  TALENT_EFFECTS,
} from "../../../src/game/content";
import { BOSSES, COMBAT_PACKS } from "../../../src/game/encounters";
import { PEARL } from "../../../src/game/content/creatures/memento";

it("resolves every authored identity without changing catalog order or sharing", () => {
  for (const card of CARDS) expect(definition(card.id)).toBe(card);
  for (const entry of SPECIES) expect(species(entry.id)).toBe(entry);
  expect(definition(PEARL.id)).toBe(PEARL);
  for (const id of ["missing", "constructor", "__proto__"])
    expect(() => definition(id)).toThrow(`Unknown card: ${id}`);
});

it("keeps shared authored rules immutable across lookup and direct catalog access", () => {
  const attempts: [object, string, unknown][] = [
    [definition("mossguard-guard"), "value", 999],
    [species("mossguard"), "health", 999],
    [species("mossguard").passiveTiers[0].effects[0]!, "amount", 999],
    [definition("cadenza-resonant-well").effects![0]!, "amount", 999],
    [BOONS[0], "text", "Changed rules"],
    [TALENTS[0], "row", 99],
    [COMBAT_PACKS[0], "0", "cadenza"],
    [BOSSES[0].pack, "0", "cadenza"],
  ];
  for (const [target, key, replacement] of attempts) {
    const original = Reflect.get(target, key);
    const changed = Reflect.set(target, key, replacement);
    if (changed) Reflect.set(target, key, original);
    expect(changed, `Shared rule ${key} must reject mutation`).toBe(false);
    expect(Reflect.get(target, key)).toEqual(original);
  }
  for (const catalog of [
    CARDS,
    SPECIES,
    BOONS,
    TALENTS,
    TALENT_EFFECTS,
    FIRST_RUN_STARTERS,
    COMBAT_PACKS,
    BOSSES,
  ])
    expect(Object.isFrozen(catalog)).toBe(true);
});
