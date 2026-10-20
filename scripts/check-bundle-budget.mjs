import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BUNDLE_BUDGET } from "./bundle-budget.mjs";

export function measureBundle(directory) {
  const files = readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? measureFiles(file)
      : entry.isFile() && entry.name.endsWith(".js")
        ? [{ file, bytes: statSync(file).size }]
        : [];
  });
  return { files, bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
}
function measureFiles(directory) {
  return measureBundle(directory).files;
}

export function checkBundleBudget(directory, budget = BUNDLE_BUDGET, log = console.log) {
  const result = measureBundle(directory);
  if (
    !result.files.length ||
    !result.files.some((file) => /^index-[\w-]+\.js$/.test(path.basename(file.file)) && file.bytes > 0)
  )
    throw new Error("Missing nonempty index JavaScript bundle; run the production build first.");
  log(
    `JavaScript bundle: ${result.bytes} bytes; limit ${budget.maxBytes}; baseline ${budget.baselineBytes}.`,
  );
  for (const file of result.files) log(`${path.relative(directory, file.file)}: ${file.bytes} bytes`);
  if (result.bytes > budget.maxBytes)
    throw new Error(
      "JavaScript bundle exceeds its measured allowance. Investigate growth before changing the budget.",
    );
  if (result.bytes > budget.warnBytes) log("Warning: JavaScript bundle exceeds 95% of its allowance.");
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error("Usage: npm run check:bundle");
  checkBundleBudget(path.resolve(import.meta.dirname, "../dist/assets"));
}
