import { describe, expect, it } from "vitest";
import { inventorySource } from "../../../scripts/localization/inventory.mjs";

describe("localization migration inventory", () => {
  it("locates literal display text, alternatives and interpolated accessible names", () => {
    const source = `// café
const View = ({ name, active }) => (
  <div aria-label={\`Choose \${name}\`} className="layout">
    Hello {active ? "Continue" : "Start"}
    <img alt="Creature" />
  </div>
);`;
    expect(inventorySource(source, "view.tsx")).toEqual([
      { file: "view.tsx", line: 3, column: 20, kind: "attribute-template", text: "Choose {…}" },
      { file: "view.tsx", line: 4, column: 5, kind: "jsx", text: "Hello" },
      { file: "view.tsx", line: 4, column: 21, kind: "jsx-expression", text: "Continue" },
      { file: "view.tsx", line: 4, column: 34, kind: "jsx-expression", text: "Start" },
      { file: "view.tsx", line: 5, column: 14, kind: "attribute", text: "Creature" },
    ]);
  });
});

it("includes non-Latin and single-letter labels while excluding punctuation and numeric literals", () => {
  const rows = inventorySource(
    "<div>続行<span>开始</span><span>É</span><span>A</span><span>123</span><span>…</span></div>",
    "labels.tsx",
  );
  expect(rows.map((row) => row.text)).toEqual(["続行", "开始", "É", "A"]);
});

it("inventories accessible value and role descriptions", () => {
  const rows = inventorySource(
    '<div aria-valuetext="Half full" aria-roledescription={active ? "Carousel" : "List"} aria-controls="panel-id" />',
    "accessibility.tsx",
  );
  expect(rows.map((row) => [row.kind, row.text])).toEqual([
    ["attribute", "Half full"],
    ["attribute", "Carousel"],
    ["attribute", "List"],
  ]);
});

it("includes both display alternatives of fallbacks but excludes logical-and conditions", () => {
  const rows = inventorySource(
    '<div>{"Default" || value}{"Fallback" ?? value}{"condition" && "Shown"}</div>',
    "fallback.tsx",
  );
  expect(rows.map((row) => row.text)).toEqual(["Default", "Fallback", "Shown"]);
});

it("finds literal text in nested JSX arrays without treating holes as expressions", () => {
  const rows = inventorySource(
    '<div>{["One", , ["Two", visible ? "Three" : "Four"], ...labels]}</div>',
    "arrays.tsx",
  );
  expect(rows.map((row) => row.text)).toEqual(["One", "Two", "Three", "Four"]);
});

it("unwraps typed display expressions without duplicating literals", () => {
  const rows = inventorySource(
    '<div>{"First" as string}{"Second" satisfies string}{("Third" as string)!}<span title={"Title" as const} /></div>',
    "typed.tsx",
  );
  expect(rows.map((row) => row.text)).toEqual(["First", "Second", "Third", "Title"]);
});

it("keeps Unicode columns and CRLF line positions after indexing source bytes", () => {
  const source =
    '// 😀 café\r\nconst View = <div>\r\n  日本語 <span title="Étoile">🌙 Moon</span>\r\n</div>;';
  const rows = inventorySource(source, "positions.tsx");
  expect(rows.map(({ line, column, text }) => ({ line, column, text }))).toEqual([
    { line: 3, column: 3, text: "日本語" },
    { line: 3, column: 19, text: "Étoile" },
    { line: 3, column: 28, text: "🌙 Moon" },
  ]);
});
