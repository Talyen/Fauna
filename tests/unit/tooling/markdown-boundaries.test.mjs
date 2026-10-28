import { expect, it } from "vitest";
import {
  headingSlugs,
  extractMarkdownLinkTargets,
  stripFencedBlocks,
} from "../../../scripts/lib/markdown.mjs";
import { checkDocumentation } from "../../../scripts/checks/check-docs.mjs";
import { put, repository } from "../../support/tooling.mjs";

it("recognizes headings indented by up to three spaces", () => {
  expect(headingSlugs("  ## Local setup\n   # Next step\n    # code")).toEqual(
    new Set(["local-setup", "next-step"]),
  );
});

it("avoids collisions with existing numbered heading anchors", () => {
  const headings = "# Guide\n# Guide-1\n# Guide\n# Guide\n";
  expect(headingSlugs(headings)).toEqual(new Set(["guide", "guide-1", "guide-2", "guide-3"]));
  const root = repository({
    "package.json": '{"scripts":{}}',
    "README.md": "[guide](Docs/guide.md#guide-3)\n",
    "Docs/guide.md": headings,
  });
  expect(checkDocumentation(root)).toEqual([]);
});

it("removes underscore emphasis while retaining literal underscores", () => {
  expect(
    headingSlugs("# _Quick_ setup\n# snake_case\n# __Important__ details\n# _snake_case_ guide"),
  ).toEqual(new Set(["quick-setup", "snake_case", "important-details", "snake_case-guide"]));
});

it("retains spaces in angle-bracket link destinations", () => {
  expect(extractMarkdownLinkTargets('[guide](<Docs/My Guide.md> "Guide")')[0].target).toBe(
    "Docs/My Guide.md",
  );
  const root = repository({
    "package.json": '{"scripts":{}}',
    "README.md": '[guide](<Docs/My Guide.md> "Guide")\n',
    "Docs/My Guide.md": "# Guide\n",
  });
  expect(checkDocumentation(root)).toEqual([]);
});

it("retains balanced and escaped parentheses in link destinations", () => {
  const links = extractMarkdownLinkTargets(
    '[one](Docs/Guide_(A).md#setup) [two](Docs/Guide_\\(B\\).md) [three](Docs/Guide_(A).md\n "Guide")',
  );
  expect(links.map(({ target }) => target)).toEqual([
    "Docs/Guide_(A).md#setup",
    "Docs/Guide_(B).md",
    "Docs/Guide_(A).md",
  ]);
  const root = repository({
    "package.json": '{"scripts":{}}',
    "README.md": "[one](Docs/Guide_(A).md#setup) [two](Docs/Guide_\\(B\\).md)\n",
    "Docs/Guide_(A).md": "  ## Setup\n",
    "Docs/Guide_(B).md": "# Guide\n",
  });
  expect(checkDocumentation(root)).toEqual([]);
  put(root, "README.md", "[missing](Docs/Missing_(C).md)\n");
  expect(checkDocumentation(root)).toEqual(["README.md: missing link Docs/Missing_(C).md"]);
});

it("does not open fences with backticks in their info string", () => {
  const source = "```invalid`info\n# Visible\n[real](README.md)";
  expect(headingSlugs(source)).toContain("visible");
  expect(stripFencedBlocks(source)).toContain("[real](README.md)");
  expect(headingSlugs("```js\n# Hidden\n```\n# Visible")).toEqual(new Set(["visible"]));
});

it("ignores link examples inside single and multiple backtick code spans", () => {
  const source = "`[fake](missing.md)` ``a ` [fake](missing.md)`` [real](README.md)";
  expect(extractMarkdownLinkTargets(source)).toEqual([
    { target: "README.md", index: source.indexOf("[real]") },
  ]);
  expect(extractMarkdownLinkTargets("`unclosed [real](README.md)")).toHaveLength(1);
  expect(extractMarkdownLinkTargets("\\`[real](README.md)`")).toHaveLength(1);
});

it("ignores escaped links but retains links after escaped backslashes", () => {
  expect(
    extractMarkdownLinkTargets(String.raw`\[fake](missing.md) \\[real](README.md)`).map(
      ({ target }) => target,
    ),
  ).toEqual(["README.md"]);
});

it("recognizes underlined headings without crossing blank lines or code fences", () => {
  expect(
    headingSlugs("First\n=====\n\nSecond\nline\n-----\n\nOrdinary\n\n---\n```\nHidden\n===\n```\n---"),
  ).toEqual(new Set(["first", "second-line"]));
});

it("checks local links with queries and preserves encoded filename delimiters", () => {
  const root = repository({
    "package.json": '{"scripts":{}}',
    "README.md": "[query](Docs/guide.md?plain=1#setup) [hash](Docs/hash%23name.md)\n",
    "Docs/guide.md": "Setup\n=====\n",
    "Docs/hash#name.md": "# Hash\n",
  });
  expect(checkDocumentation(root)).toEqual([]);
  put(root, "README.md", "[bad](Docs/guide.md?plain=1#missing) [bad](Docs/missing.md?plain=1)");
  expect(checkDocumentation(root)).toEqual([
    "README.md: missing heading Docs/guide.md?plain=1#missing",
    "README.md: missing link Docs/missing.md?plain=1",
  ]);
});

it("refreshes cached heading indexes on each documentation check", () => {
  const root = repository({
    "package.json": '{"scripts":{}}',
    "README.md": "[one](Docs/guide.md#setup) [two](Docs/guide.md#setup)",
    "Docs/guide.md": "# Setup",
  });
  expect(checkDocumentation(root)).toEqual([]);
  put(root, "Docs/guide.md", "# Changed");
  expect(checkDocumentation(root)).toHaveLength(2);
});
