import { describe, it, expect } from "vitest";
import { sourceViolations } from "../../scripts/ui-contract.mjs";

describe("design-system enforcement", () => {
  it("rejects a screen bypassing shared controls, artwork and styling", () => {
    const violations = sourceViolations(
      "src/ui/new-screen.tsx",
      `
      import * as Dialog from '@radix-ui/react-dialog';
      export const Screen = () => <button style={{ color: 'red' }} className="text-red-500"><img /></button>;
    `,
    );
    expect(violations).toHaveLength(5);
  });
  it("rejects palette, typography and radius drift outside the token owner", () => {
    expect(
      sourceViolations(
        "src/ui/new-screen.css",
        ".card { color: #ff0000; font-size: 19px; border-radius: 99px; }",
      ),
    ).toHaveLength(3);
    expect(sourceViolations("src/ui/tokens.css", ":root { --health: #f87171; }")).toEqual([]);
  });
  it("accepts semantic styles and component compositions", () => {
    expect(
      sourceViolations(
        "src/ui/new-screen.tsx",
        '<Button variant="outline"><ArtCard artwork="./art/test.svg" aspect="creature" /></Button>',
      ),
    ).toEqual([]);
    expect(
      sourceViolations(
        "src/ui/new-screen.css",
        ".label { color: var(--health); font-size: var(--text-body); border-radius: var(--radius); }",
      ),
    ).toEqual([]);
  });
});
