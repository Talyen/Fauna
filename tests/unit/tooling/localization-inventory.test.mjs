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
