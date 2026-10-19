import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Source-policy guard. Rendered behavior and accessibility need browser verification too. */
export function sourceViolations(file, source) {
  const violations = [];
  const fail = (message) => violations.push(`${file}: ${message}`);
  if (file.endsWith(".css") && file !== "src/ui/tokens.css") {
    if (/#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\(/i.test(source))
      fail("Define literal colors in src/ui/tokens.css.");
    if (/font-size\s*:\s*(?!var\()[\d.]/.test(source)) fail("Use the shared typography tokens.");
    if (/border-radius\s*:\s*(?!var\(|inherit)[\d.]/.test(source)) fail("Use the shared radius token.");
  }
  if (!file.endsWith(".tsx")) return violations;
  if (/from\s+["']@radix-ui\//.test(source) && !file.startsWith("src/components/ui/"))
    fail("Compose Radix through the source-owned shadcn primitives.");
  if (
    /<(?:button|input|select|textarea|dialog)(?=[\s/>])/.test(source) &&
    !file.startsWith("src/components/ui/")
  )
    fail("Use shared control primitives instead of raw controls.");
  if (/<img(?=[\s/>])/.test(source) && file !== "src/ui/art-card.tsx")
    fail("Game artwork must use ArtCard to preserve composition and states.");
  if (/\bstyle\s*=\s*\{/.test(source))
    fail("Use shared CSS classes and tokens rather than inline visual styles.");
  if (
    /\b(?:text|bg|border|ring)-(?:red|orange|yellow|green|emerald|cyan|blue|sky|slate|zinc|neutral|stone|gray|violet|pink)-\d/.test(
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
      else if (/\.(tsx|css)$/.test(file))
        violations.push(...sourceViolations(file, await readFile(file, "utf8")));
    }
  }
  await inspect("src");
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  for (const dependency of Object.keys(manifest.dependencies))
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
