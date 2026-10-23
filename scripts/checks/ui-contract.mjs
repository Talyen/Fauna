import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import registry from "./shadcn-registry.json" with { type: "json" };
import { pathToFileURL } from "node:url";
import { parseSync } from "@swc/core";

const primitives = new Map(
  Object.entries(registry).map(([name, dependency]) => [
    `src/components/ui/${name}.tsx`,
    { name, dependency },
  ]),
);
const rawControls = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "dialog",
  "details",
  "summary",
  "progress",
  "meter",
]);
const widgetRoles = new Set([
  "button",
  "tab",
  "tablist",
  "tabpanel",
  "switch",
  "checkbox",
  "radio",
  "radiogroup",
  "combobox",
  "listbox",
  "option",
  "slider",
  "spinbutton",
  "dialog",
  "alertdialog",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tree",
  "treeitem",
]);
const palette =
  /\b(?:text|bg|border|ring|outline|decoration|accent|caret|divide|fill|stroke|from|via|to|shadow)-(?:(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|blue|sky|slate|zinc|neutral|stone|gray|indigo|violet|purple|fuchsia|pink|rose)-\d|(?:white|black)\b)/;
const embeddedColor = /#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch|oklab|hwb|lab|lch)a?\(/i;
const literalColor = /^(?:#[\da-f]{3,8}\b|(?:rgb|hsl|oklch|oklab|hwb|lab|lch)a?\()/i;
const paintProperty =
  /^(?:color|background(?:Color|-color)?|borderColor|border-color|outlineColor|outline-color|fill|stroke)$/;
const namedColor = /^(?:black|white|red|orange|yellow|green|blue|purple|pink|gray|grey|gold)$/i;
const valueOf = (node) => (node?.type === "JSXExpressionContainer" ? valueOf(node.expression) : node?.value);
const memberName = (node) =>
  node?.type === "MemberExpression"
    ? valueOf(node.property?.type === "Computed" ? node.property.expression : node.property)
    : undefined;

/** Production source policy; test fixtures and development studies may use native controls. */
export function sourceViolations(file, source) {
  file = file.replaceAll("\\", "/");
  if (!file.startsWith("src/") || file.startsWith("src/tooling/")) return [];
  const violations = new Set();
  const fail = (message) => violations.add(`${file}: ${message}`);
  const presentation = file.startsWith("src/ui/") || file.startsWith("src/components/");
  const scrolling = () =>
    fail("Player UI cannot scroll. Reflow, resize artwork within its bounds, or paginate content.");
  const imperativeScroll = () =>
    fail("Player UI cannot scroll imperatively, including during focus navigation.");
  const colors = () => fail("Define literal colors in src/ui/tokens.css.");
  const controls = () => fail("Use shared shadcn control primitives instead of raw controls.");

  if (file.endsWith(".css")) {
    const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
    if (presentation && /\boverflow(?:-[xy])?\s*:\s*(?:hidden\s+)?(?:auto|scroll)\b/i.test(css)) scrolling();
    if (file !== "src/ui/tokens.css") {
      if (/#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch|oklab|hwb|lab|lch)a?\(/i.test(css)) colors();
      if (/font-size\s*:\s*(?!var\()[\d.]/.test(css)) fail("Use the shared typography tokens.");
      if (/border-radius\s*:\s*(?!var\(|inherit)[\d.]/.test(css)) fail("Use the shared radius token.");
      if (
        /(?:color|background(?:-color)?|border-color|outline-color|fill|stroke)\s*:\s*(?:black|white|red|orange|yellow|green|blue|purple|pink|gray|grey|gold)\b/i.test(
          css,
        )
      )
        fail("Use semantic theme tokens instead of named color literals.");
    }
    if (file !== "src/ui/design-system.css") {
      if (/\.ui-(?:tab|switch|slider|radio)\b/.test(css))
        fail("Shared shadcn state styling belongs in src/ui/design-system.css; screens own layout only.");
      for (const [, selector, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
        if (/\.control-primary\b/.test(selector) && /(?:^|;)\s*color\s*:/.test(declarations))
          fail("Primary control foreground belongs in src/ui/design-system.css.");
    }
    return [...violations];
  }
  if (!/\.tsx?$/.test(file)) return [];
  const primitive = primitives.get(file);
  if (file.startsWith("src/components/ui/") && !primitive)
    fail("Register a reviewed upstream shadcn primitive; custom controls are not allowed here.");
  const radixImports = new Set();
  const inspectLiteral = (text) => {
    if (typeof text !== "string" || !presentation) return;
    if (literalColor.test(text.trim())) colors();
    if (palette.test(text)) fail("Use semantic color tokens instead of utility palettes.");
    if (/\boverflow(?:-[xy])?-(?:auto|scroll)\b/.test(text)) scrolling();
  };
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "ImportDeclaration" ||
      node.type === "ExportAllDeclaration" ||
      node.type === "ExportNamedDeclaration"
    ) {
      const dependency = node.source?.value;
      if (dependency?.startsWith("@radix-ui/")) radixImports.add(dependency);
    }
    if (node.type === "StringLiteral") inspectLiteral(node.value);
    if (node.type === "TemplateElement") inspectLiteral(node.cooked ?? node.raw);
    if (node.type === "KeyValueProperty") {
      const key = valueOf(node.key),
        value = valueOf(node.value);
      if (presentation && paintProperty.test(key) && typeof value === "string" && embeddedColor.test(value))
        colors();
      if (presentation && paintProperty.test(key) && namedColor.test(value))
        fail("Use semantic theme tokens instead of named color literals.");
      if (presentation && /^overflow(?:[XY])?$/.test(key) && /^(?:hidden\s+)?(?:auto|scroll)$/.test(value))
        scrolling();
    }
    if (node.type === "CallExpression") {
      const name = memberName(node.callee) ?? valueOf(node.callee);
      if (presentation && ["scrollTo", "scrollBy", "scrollIntoView"].includes(name)) imperativeScroll();
      if (
        !primitive &&
        ["createElement", "jsx", "jsxs"].includes(name) &&
        rawControls.has(valueOf(node.arguments[0]?.expression))
      )
        controls();
      const dependency = valueOf(node.arguments[0]?.expression);
      if ((node.callee?.type === "Import" || name === "require") && dependency?.startsWith("@radix-ui/"))
        radixImports.add(dependency);
    }
    if (
      presentation &&
      ["AssignmentExpression", "UpdateExpression"].includes(node.type) &&
      ["scrollTop", "scrollLeft"].includes(memberName(node.left ?? node.argument))
    )
      imperativeScroll();
    if (node.type === "JSXOpeningElement") {
      const tag = valueOf(node.name);
      if (!primitive && rawControls.has(tag)) controls();
      if (tag === "img" && file !== "src/ui/shared/cards/art-card.tsx")
        fail("Game artwork must use ArtCard to preserve composition and states.");
      for (const attribute of node.attributes) {
        const name = valueOf(attribute.name);
        if (!primitive && name === "role" && widgetRoles.has(valueOf(attribute.value)))
          fail("Use the matching shadcn component instead of recreating widget roles.");
        // Container keyboard handlers route Escape/navigation without making a widget.
        if (!primitive && /^[a-z]/.test(tag ?? "") && ["onClick", "onPointerDown"].includes(name))
          fail("Do not turn layout elements into controls; compose a shadcn primitive.");
      }
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === "span") continue;
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  }
  visit(parseSync(source, { syntax: "typescript", tsx: file.endsWith(".tsx"), target: "es2022" }));
  if ([...radixImports].some((dependency) => dependency !== primitive?.dependency))
    fail("Compose Radix through its registered source-owned shadcn primitive.");
  if (
    primitive &&
    (!source.includes(`https://ui.shadcn.com/r/styles/new-york/${primitive.name}.json`) ||
      !radixImports.has(primitive.dependency))
  )
    fail("Retain the registered shadcn provenance and upstream behavior owner.");
  return [...violations];
}

async function check() {
  const violations = [];
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) await inspect(file);
      else if (/\.(tsx?|css)$/.test(file))
        violations.push(...sourceViolations(file, await readFile(file, "utf8")));
    }
  }
  await inspect("src");
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }))
    if (
      /^(?:@mantine\/|@mui\/|@chakra-ui\/|@react-aria\/|react-aria-components$|antd$|@blueprintjs\/)/.test(
        dependency,
      )
    )
      violations.push(`package.json: ${dependency} introduces a second UI system.`);
  if (violations.length) throw new Error(`UI contract violations:\n${violations.join("\n")}`);
  console.log("UI contract passed: tokens, artwork, controls, and primitive ownership.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await check();
