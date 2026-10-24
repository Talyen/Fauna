import { expect, it } from "vitest";
import {
  CARDS,
  SPECIES,
  definition,
  species,
  speciesCards,
  FIRST_RUN_STARTERS,
  BOONS,
  TALENTS,
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
  for (const catalog of [CARDS, SPECIES, BOONS, TALENTS, FIRST_RUN_STARTERS, COMBAT_PACKS, BOSSES])
    expect(Object.isFrozen(catalog)).toBe(true);
});

it("keeps indexed kits immutable and in the original order for every species", () => {
  for (const { id } of SPECIES) {
    const cards = speciesCards(id);
    const authored = CARDS.filter((card) => card.species === id);
    expect(cards).toEqual(authored);
    expect(Object.isFrozen(cards)).toBe(true);
    for (let index = 0; index < cards.length; index++) expect(cards[index]).toBe(authored[index]);
    expect(
      Reflect.set(
        cards,
        "0",
        CARDS.find((card) => card.species !== id),
      ),
    ).toBe(false);
    expect(speciesCards(id)).toEqual(authored);
  }
});
