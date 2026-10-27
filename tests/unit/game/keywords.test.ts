import { expect, it } from "vitest";
import { definitionKeywords } from "../../../src/game/keywords";
import { CARDS } from "../../../src/game/content";
import { cardHasKeyword, cardKeywords, KEYWORDS } from "../../../src/game/progression";

it("keeps first-occurrence keyword order while merging duplicate and aliased effects", () => {
  const card = {
    effect: "attack" as const,
    damageType: "water" as const,
    alternateDamageType: "light" as const,
    leech: true,
    effects: [
      { kind: "status", status: "thorns" },
      { kind: "heal" },
      { kind: "cleanse" },
      { kind: "damage", damageType: "water" as const, leech: true },
      { kind: "meltArmor" },
      { kind: "draw" },
      { kind: "mana" },
      { kind: "nullifyFreeze" },
    ],
  };
  const expected = ["water", "light", "nature", "health", "leech", "mana"];
  const keywords = definitionKeywords(card);
  expect(keywords).toEqual(expected);
  keywords.reverse();
  expect(definitionKeywords(card)).toEqual(expected);
  expect(definitionKeywords({ effect: "draw" })).toEqual([]);
  expect(definitionKeywords({ effect: "teamProtection", effects: [{ kind: "purge" }] })).toEqual([
    "block",
    "nature",
    "light",
  ]);
});

it("keeps keyword membership equivalent to an independent mutable keyword list", () => {
  for (const definition of CARDS) {
    const card = { definitionId: definition.id };
    const expected = definitionKeywords(definition);
    const copy = cardKeywords(card);
    expect(copy).toEqual(expected);
    copy.length = 0;
    for (const keyword of KEYWORDS) expect(cardHasKeyword(card, keyword)).toBe(expected.includes(keyword));
    expect(cardKeywords(card)).toEqual(expected);
  }
});
