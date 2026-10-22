import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { sourceViolations } from "../../../scripts/checks/ui-contract.mjs";

describe("design-system enforcement", () => {
  it("rejects scrolling in CSS, utilities, and imperative navigation", () => {
    for (const source of [
      ".panel { overflow: auto; }",
      ".panel { overflow-y: scroll; }",
      ".panel { overflow: hidden auto; }",
    ])
      expect(sourceViolations("src/ui/screen.css", source).length).toBeGreaterThan(0);
    for (const source of [
      '<div className="overflow-x-auto" />',
      "root.scrollBy({ top: 10 });",
      "root.scrollIntoView();",
      "root.scrollTo?.(0, 0);",
      "root.scrollTop = 10;",
    ])
      expect(sourceViolations("src/ui/shared/navigation/screen.tsx", source).length).toBeGreaterThan(0);
    expect(sourceViolations("src/ui/screen.css", ".surface { overflow: clip; }")).toEqual([]);
  });
  it("rejects a screen bypassing shared controls, artwork and styling", () => {
    const violations = sourceViolations(
      "src/ui/new-screen.tsx",
      `
      import * as Dialog from '@radix-ui/react-dialog';
      export const Screen = () => <button style={{ color: 'red' }} className="text-red-500"><img /></button>;
    `,
    );
    expect(violations).toHaveLength(4);
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

it("rejects handmade widgets and unregistered primitive escape hatches", () => {
  for (const source of [
    '<div role="tablist"><Button role="tab" /></div>',
    '<Button role={"switch"} aria-checked={true} />',
    "<div onClick={() => select()} tabIndex={0} />",
    "<summary>Settings</summary>",
    'React.createElement("button", {onClick: select})',
  ])
    expect(sourceViolations("src/ui/shared/navigation/screen.tsx", source).length).toBeGreaterThan(0);
  expect(sourceViolations("src/components/ui/homemade-tabs.tsx", "<button />").length).toBeGreaterThan(0);
  expect(sourceViolations("src/components/ui/tabs.tsx", "<button />").length).toBeGreaterThan(0);
  expect(
    sourceViolations(
      "src/ui/shared/navigation/screen.tsx",
      '<Tabs><TabsList><TabsTrigger value="fire">Fire</TabsTrigger></TabsList><TabsContent value="fire" /></Tabs>',
    ),
  ).toEqual([]);
});

it("rejects color literals in code, named CSS colors and utility palette escapes", () => {
  for (const source of [
    '<Button className="text-amber-300" />',
    '<Button className="bg-white" />',
    'const theme = { primary: "#ccaa66" };',
  ])
    expect(sourceViolations("src/ui/shared/navigation/screen.tsx", source).length).toBeGreaterThan(0);
  expect(
    sourceViolations("src/ui/screen.css", ".control { color: gold; background: white; }").length,
  ).toBeGreaterThan(0);
});

it("keeps the approved semantic palette readable and combat colors independent", () => {
  const css = readFileSync(new URL("../../../src/ui/tokens.css", import.meta.url), "utf8");
  const tokens = Object.fromEntries(
    [...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]]),
  );
  const resolve = (name) => {
    const value = tokens[name];
    const alias = /^var\(--([\w-]+)\)$/.exec(value);
    return alias ? resolve(alias[1]) : value;
  };
  const luminance = (hex) => {
    const expanded =
      hex.length === 4
        ? "#" +
          hex
            .slice(1)
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    const values = [1, 3, 5]
      .map((i) => parseInt(expanded.slice(i, i + 2), 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  for (const [text, background] of [
    ["foreground", "background"],
    ["destructive-text", "background"],
    ["card-foreground", "card"],
    ["popover-foreground", "popover"],
    ["primary-foreground", "primary"],
    ["secondary-foreground", "secondary"],
    ["accent-foreground", "accent"],
    ["muted-foreground", "muted"],
    ["muted-foreground", "popover"],
    ["destructive-foreground", "destructive"],
  ]) {
    const a = luminance(resolve(text)),
      b = luminance(resolve(background));
    expect(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      `${text} on ${background}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
  expect(resolve("background")).toBe("#080807");
  expect(resolve("primary")).toBe("#cd9b51");
  expect(resolve("health")).toBe("#f87171");
  expect(resolve("block")).toBe("#7dd3fc");
  for (const alias of ["selected", "line", "surface", "text"]) expect(tokens[alias]).toMatch(/^var\(--/);
});

it("allows token-based inline geometry and local interaction styling while preserving shared control ownership", () => {
  expect(
    sourceViolations(
      "src/ui/card.tsx",
      '<ArtCard style={{ transform: "translateX(10px)", color: "var(--foreground)" }} className="rounded-none" />',
    ),
  ).toEqual([]);
  expect(sourceViolations("src/ui/screen.tsx", '<Button className="hover:bg-primary" />')).toEqual([]);
  expect(sourceViolations("src/ui/screen.css", ".selected:hover { outline-width: 3px; }")).toEqual([]);
  expect(
    sourceViolations(
      "src/ui/design-system.css",
      '.ui-tab[data-state="active"]:hover { background: var(--muted); }',
    ),
  ).toEqual([]);
  expect(
    sourceViolations("src/ui/screen.css", ".ui-tab { background: var(--muted); }").length,
  ).toBeGreaterThan(0);
});

it("rejects primary control foreground overrides even when they use valid palette tokens", () => {
  const override = ".shop .control-primary { color: var(--gold-pale); }";
  expect(sourceViolations("src/ui/shop.css", override)).toEqual([
    "src/ui/shop.css: Primary control foreground belongs in src/ui/design-system.css.",
  ]);
  expect(
    sourceViolations(
      "src/ui/design-system.css",
      ".game-button.control-primary { color: var(--primary-foreground); }",
    ),
  ).toEqual([]);
});
