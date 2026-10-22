import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import registry from "./shadcn-registry.json" with { type: "json" };
import { pathToFileURL } from "node:url";

// Every primitive is explicitly registered with its upstream owner. Add library
// components here during review; do not use components/ui as a custom-control escape hatch.
const primitives = new Map(
  Object.entries(registry).map(([name, dependency]) => [
    `src/components/ui/${name}.tsx`,
    { name, dependency },
  ]),
);
const widgetRoles =
  /<[\w.:-]+\b[^>]*\brole\s*=\s*(?:["']|\{["'])(?:button|tab|tablist|tabpanel|switch|checkbox|radio|radiogroup|combobox|listbox|option|slider|spinbutton|dialog|alertdialog|menu|menubar|menuitem|menuitemcheckbox|menuitemradio|tree|treeitem)(?:["']|["']\})/;

/** Source-policy guard. Rendered behavior and accessibility need browser verification too. */
export function sourceViolations(file, source) {
  const violations = [];
  const fail = (message) => violations.push(`${file}: ${message}`);
  if (file.startsWith("src/ui/") || file.startsWith("src/components/")) {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    if (
      /\boverflow(?:-[xy]|[XY])?\s*:\s*["']?(?:hidden\s+)?(?:auto|scroll)\b/i.test(code) ||
      /\boverflow(?:-[xy])?-(?:auto|scroll)\b/.test(code)
    )
      fail("Player UI cannot scroll. Reflow, resize artwork within its bounds, or paginate content.");
    if (
      /\.\s*scroll(?:To|By|IntoView)\s*(?:\?\.)?\s*\(/.test(code) ||
      /\.\s*scroll(?:Top|Left)\s*(?:=(?!=)|\+=|-=)/.test(code)
    )
      fail("Player UI cannot scroll imperatively, including during focus navigation.");
  }
  if (file.endsWith(".css") && file !== "src/ui/tokens.css") {
    if (/#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch|oklab|hwb|lab|lch)a?\(/i.test(source))
      fail("Define literal colors in src/ui/tokens.css.");
    if (/font-size\s*:\s*(?!var\()[\d.]/.test(source)) fail("Use the shared typography tokens.");
    if (/border-radius\s*:\s*(?!var\(|inherit)[\d.]/.test(source)) fail("Use the shared radius token.");
  }
  if (
    file !== "src/ui/tokens.css" &&
    (file.endsWith(".tsx") || file.startsWith("src/ui/") || file.startsWith("src/components/"))
  ) {
    if (/#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch|oklab|hwb|lab|lch)a?\(/i.test(source) && !file.endsWith(".css"))
      fail("Define literal colors in src/ui/tokens.css.");
    if (
      /(?:color|background(?:-color)?|border-color|outline-color|fill|stroke)\s*:\s*(?:black|white|red|orange|yellow|green|blue|purple|pink|gray|grey)\b/i.test(
        source,
      )
    )
      fail("Use semantic theme tokens instead of named color literals.");
  }
  if (file.endsWith(".css")) {
    if (file !== "src/ui/design-system.css" && /\.ui-(?:tab|switch|slider|radio)\b/.test(source))
      fail("Shared shadcn state styling belongs in src/ui/design-system.css; screens own layout only.");
    for (const [, selector, declarations] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g))
      if (
        file !== "src/ui/design-system.css" &&
        /\.control-primary\b/.test(selector) &&
        /(?:^|;)\s*color\s*:/.test(declarations)
      )
        fail("Primary control foreground belongs in src/ui/design-system.css.");
      else if (
        selector.includes(":hover") &&
        /(?:\.selected|aria-(?:pressed|selected)=["']true|data-state=["'](?:active|checked))/.test(
          selector,
        ) &&
        /border-width\s*:|outline-width\s*:|box-shadow\s*:[^;]*inset/.test(declarations)
      )
        fail("Selected hover must not thicken a border or selection ring.");
      else if (
        /\.ui-tab\b/.test(selector) &&
        selector.includes(":hover") &&
        /data-state=["']active/.test(selector)
      )
        fail("Selected tabs retain their resting appearance on hover.");
  }
  if (!/\.tsx?$/.test(file)) return violations;
  const primitive = primitives.get(file);
  if (file.startsWith("src/components/ui/") && !primitive)
    fail("Register a reviewed upstream shadcn primitive; custom controls are not allowed here.");
  const radixImports = [...source.matchAll(/(?:from\s*|import\s*)["'](@radix-ui\/[^"']+)["']/g)].map(
    (match) => match[1],
  );
  if (radixImports.some((dependency) => dependency !== primitive?.dependency))
    fail("Compose Radix through its registered source-owned shadcn primitive.");
  if (
    primitive &&
    (!source.includes(`https://ui.shadcn.com/r/styles/new-york/${primitive.name}.json`) ||
      !radixImports.includes(primitive.dependency))
  )
    fail("Retain the registered shadcn provenance and upstream behavior owner.");
  if (!primitive) {
    if (
      /(?:hover|focus-visible|active|disabled|data-\[state=)[^"'\s]*:(?:bg|border|ring|outline|scale|opacity|duration)-/.test(
        source,
      )
    )
      fail(
        "Use shared shadcn variants for control interaction states, rather than screen-local state utilities.",
      );
    if (
      /<(?:button|input|select|textarea|dialog|details|summary|progress|meter)(?=[\s/>])/.test(source) ||
      /(?:createElement|jsx|jsxs)\s*\(\s*["'](?:button|input|select|textarea|dialog)["']/.test(source)
    )
      fail("Use shared shadcn control primitives instead of raw controls.");
    if (widgetRoles.test(source))
      fail("Use the matching shadcn component instead of recreating widget roles.");
    if (/<[a-z][\w-]*\b[^>]*\b(?:onClick|onKeyDown|onPointerDown)\s*=/.test(source))
      fail("Do not turn layout elements into controls; compose a shadcn primitive.");
  }
  if (/<img(?=[\s/>])/.test(source) && file !== "src/ui/shared/cards/art-card.tsx")
    fail("Game artwork must use ArtCard to preserve composition and states.");
  if (/\brounded-(?:none\b|\[)/.test(source))
    fail("Use the shared nonzero shadcn radius scale; no sharp-corner overrides.");
  if (/\bstyle\s*=\s*\{/.test(source))
    fail("Use shared CSS classes and tokens rather than inline visual styles.");
  if (
    /\b(?:text|bg|border|ring|outline|decoration|accent|caret|divide|fill|stroke|from|via|to|shadow)-(?:(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|blue|sky|slate|zinc|neutral|stone|gray|indigo|violet|purple|fuchsia|pink|rose)-\d|(?:white|black)\b)/.test(
      source,
    )
  )
    fail("Use semantic color tokens instead of utility palettes.");
  return violations;
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
