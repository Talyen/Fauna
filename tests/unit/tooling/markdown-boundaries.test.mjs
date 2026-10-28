import { expect, it } from "vitest";
import { headingSlugs, extractMarkdownLinkTargets } from "../../../scripts/lib/markdown.mjs";
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
