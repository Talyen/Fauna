import { readFileSync } from "node:fs";
import { parseSync } from "@swc/core";
import { expect, it } from "vitest";
import { extractProjectContent } from "../../../scripts/localization/content.mjs";
import { extractProjectMessages } from "../../../scripts/localization/messages.mjs";
import { evaluate } from "../../../scripts/localization/boon-rules.mjs";

it("preserves authored localization and rejects unsupported literal expressions", () => {
  const catalog = JSON.parse(readFileSync("src/ui/shared/localization/content.en.json", "utf8"));
  expect(extractProjectContent(process.cwd())).toEqual(catalog);
  const messages = JSON.parse(readFileSync("src/ui/shared/localization/messages.en.json", "utf8"));
  expect(extractProjectMessages(process.cwd())).toEqual(messages);
  const expression = (source) =>
    parseSync(`const result = ${source}`, { syntax: "typescript" }).body[0].declarations[0].init;
  expect(evaluate(expression("p.amount * 2"), { amount: 3 }, "p")).toBe(6);
  expect(() => evaluate(expression("p.missing"), { amount: 3 }, "p")).toThrow(
    "Unsupported rule description expression",
  );
  expect(() => evaluate(expression("p.amount + 2"), { amount: 3 }, "p")).toThrow(
    "Unsupported rule description expression",
  );
  expect(() => evaluate(expression("run()"), {}, "p")).toThrow("Unsupported rule description expression");
});
