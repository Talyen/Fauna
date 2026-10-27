import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import catalog from "../../../src/ui/shared/localization/content.en.json";
import { ruleMessage } from "../../../src/ui/shared/localization/rule-message";
import { keywordPattern, templateFor } from "../../../scripts/localization/boon-rules.mjs";

it("matches extracted and presented rules for the complete authored catalog", () => {
  const pattern = keywordPattern(readFileSync("src/game/keywords.ts", "utf8"));
  const rules = Object.entries(catalog).filter(([, entry]) => "reference" in entry);
  expect(rules.length).toBeGreaterThan(0);
  for (const [id, entry] of rules) {
    if (!("reference" in entry)) continue;
    expect(templateFor(entry.reference, pattern), id).toBe(entry.text);
    expect(ruleMessage(entry.reference).template, id).toBe(entry.text);
  }
  const message = ruleMessage("Burning deals 12 Burn damage; Gain 2.5 Block");
  expect(message.template).toBe(
    "<keyword0>Burning</keyword0> deals {{value0}} <keyword1>Burn</keyword1> damage; Gain {{value1}} <keyword2>Block</keyword2>",
  );
  expect(message.values).toEqual({ value0: "12", value1: "2.5" });
  expect(message.keywords).toEqual({ keyword0: "burn", keyword1: "burn", keyword2: "block" });
});
