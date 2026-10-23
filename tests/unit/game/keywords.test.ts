import { expect, it } from "vitest";
import { definitionKeywords } from "../../../src/game/keywords";

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
