import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { extractCardVariants } from "../../../scripts/localization/card-variants.mjs";

it("rejects card branches not covered by the translated numeric forms", () => {
  const sources = {
    cardRules: readFileSync("src/game/card-rules.ts", "utf8"),
    abilities: readFileSync("src/game/rules/abilities.ts", "utf8"),
    supplemental: readFileSync("src/game/rules/supplemental.ts", "utf8"),
    contracts: readFileSync("src/game/rules/contracts.ts", "utf8"),
    abilityValues: readFileSync("src/game/combat/ability-values.ts", "utf8"),
  };
  const keywords = readFileSync("src/game/keywords.ts", "utf8");
  expect(() => extractCardVariants([], sources, keywords)).not.toThrow();
  expect(() =>
    extractCardVariants(
      [],
      { ...sources, abilities: sources.abilities.replace("value === 1", "value === 3") },
      keywords,
    ),
  ).toThrow("Unsupported dynamic card branch");
  expect(() =>
    extractCardVariants(
      [],
      {
        ...sources,
        cardRules: sources.cardRules.replace(
          "if (card.leech)",
          'if (value === 4) text += " extra"; if (card.leech)',
        ),
      },
      keywords,
    ),
  ).toThrow("Unsupported dynamic card branch: cardText");
  expect(() =>
    extractCardVariants(
      [],
      {
        ...sources,
        supplemental: sources.supplemental.replace(
          "${effect.amount} ${label(effect.damageType)} damage",
          "${effect.amount === 1 ? effect.amount : effect.amount} ${label(effect.damageType)} damage",
        ),
      },
      keywords,
    ),
  ).toThrow("Unsupported scaled supplemental branch");
});
