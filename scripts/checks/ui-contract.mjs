import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import registry from "./shadcn-registry.json" with { type: "json" };
import { pathToFileURL } from "node:url";
import { parseSync } from "@swc/core";
import postcss from "postcss";

const primitives = new Map(
  Object.entries(registry).map(([name, entry]) => [`src/components/ui/${name}.tsx`, { name, ...entry }]),
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
const paintProperty =
  /^(?:color|background(?:Color|-color)?|borderColor|border-color|outlineColor|outline-color|fill|stroke)$/;
const cssPaintProperty =
  /^(?:--[\w-]+|color|background(?:-[\w-]+)?|border(?:-[\w-]+)?|outline(?:-[\w-]+)?|fill|stroke|(?:box|text)-shadow|(?:text-decoration|caret|accent|column-rule)-color)$/i;
const paintValue = (value) => value.replace(/url\([^)]*\)/gi, "");
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
  const colors = () => fail("Define literal colors in src/ui/tokens.css.");
  const controls = () => fail("Use shared shadcn control primitives instead of raw controls.");

  if (file.endsWith(".css")) {
    const css = postcss.parse(source, { from: file });
    css.walkDecls((declaration) => {
      const { prop: property, value: raw } = declaration;
      const value = paintValue(raw);
      if (file !== "src/ui/tokens.css") {
        if (cssPaintProperty.test(property) && embeddedColor.test(value)) colors();
        if (cssPaintProperty.test(property) && namedColor.test(value.trim()))
          fail("Use semantic theme tokens instead of named color literals.");
        if (property === "font-size" && /^[\d.]/.test(value)) fail("Use the shared typography tokens.");
        if (property === "border-radius" && /^[\d.]/.test(value)) fail("Use the shared radius token.");
      }
      const selector = declaration.parent.type === "rule" ? declaration.parent.selector : "";
      if (file !== "src/ui/design-system.css" && /\.control-primary\b/.test(selector) && property === "color")
        fail("Primary control foreground belongs in src/ui/design-system.css.");
    });
    if (file !== "src/ui/design-system.css")
      css.walkRules((rule) => {
        if (/\.ui-(?:tab|switch|slider|radio)\b/.test(rule.selector))
          fail("Shared shadcn state styling belongs in src/ui/design-system.css; screens own layout only.");
      });
    return [...violations];
  }
  if (!/\.tsx?$/.test(file)) return [];
  const primitive = primitives.get(file);
  if (file.startsWith("src/components/ui/") && !primitive)
    fail("Register a reviewed upstream shadcn primitive; custom controls are not allowed here.");
  const radixImports = new Set();
  const inspectClasses = (node) => {
    if (!node || typeof node !== "object" || !presentation) return;
    const text = node.type === "TemplateElement" ? (node.cooked ?? node.raw) : valueOf(node);
    if (typeof text === "string") {
      if (embeddedColor.test(paintValue(text))) colors();
      if (palette.test(text)) fail("Use semantic color tokens instead of utility palettes.");
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(inspectClasses);
      else if (child && typeof child === "object") inspectClasses(child);
    }
  };
  const inspectStyle = (node) => {
    if (!node || typeof node !== "object" || !presentation) return;
    if (node.type === "KeyValueProperty") {
      const key = valueOf(node.key),
        value = valueOf(node.value);
      if (paintProperty.test(key) && typeof value === "string") {
        if (embeddedColor.test(paintValue(value))) colors();
        if (namedColor.test(value)) fail("Use semantic theme tokens instead of named color literals.");
      }
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(inspectStyle);
      else if (child && typeof child === "object") inspectStyle(child);
    }
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
    if (node.type === "KeyValueProperty") {
      if (valueOf(node.key) === "className") inspectClasses(node.value);
      if (valueOf(node.key) === "style") inspectStyle(node.value);
    }
    if (node.type === "VariableDeclarator") {
      if (/^(?:className|classes|classNames)$/.test(valueOf(node.id))) inspectClasses(node.init);
      if (valueOf(node.id) === "style") inspectStyle(node.init);
    }
    if (node.type === "CallExpression") {
      const name = memberName(node.callee) ?? valueOf(node.callee);
      if (["cn", "clsx", "cva"].includes(name))
        node.arguments.forEach((argument) => inspectClasses(argument.expression));
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
    if (node.type === "JSXOpeningElement") {
      const tag = valueOf(node.name);
      if (!primitive && rawControls.has(tag)) controls();
      if (tag === "img" && file !== "src/ui/shared/cards/art-card.tsx")
        fail("Game artwork must use ArtCard to preserve composition and states.");
      for (const attribute of node.attributes) {
        const name = valueOf(attribute.name);
        if (name === "className") inspectClasses(attribute.value);
        if (name === "style") inspectStyle(attribute.value);
        if (presentation && paintProperty.test(name)) {
          const value = valueOf(attribute.value);
          if (typeof value === "string" && (embeddedColor.test(value) || namedColor.test(value))) colors();
        }
        if (!primitive && name === "role" && widgetRoles.has(valueOf(attribute.value)))
          fail("Use the matching shadcn component instead of recreating widget roles.");
        // A focusable click target is a control; bubbling and pointer gesture handlers alone are not.
        if (
          !primitive &&
          /^[a-z]/.test(tag ?? "") &&
          name === "onClick" &&
          node.attributes.some(
            (attr) => valueOf(attr.name) === "tabIndex" && Number(valueOf(attr.value)) >= 0,
          )
        )
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
  if (primitive && !radixImports.has(primitive.dependency))
    fail("Retain the registered upstream behavior owner.");
  return [...violations];
}

export function registryViolations(entries = registry) {
  return Object.entries(entries).flatMap(([name, entry]) =>
    entry &&
    typeof entry.dependency === "string" &&
    entry.dependency.startsWith("@radix-ui/") &&
    entry.source === `https://ui.shadcn.com/r/styles/new-york/${name}.json`
      ? []
      : [`${name}: Record the upstream shadcn source and Radix behavior owner in the primitive registry.`],
  );
}

async function check() {
  const violations = registryViolations();
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
