import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.tsx?$/.test(file)) {
      const source = await readFile(file, "utf8");
      const imports = [...source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
      for (const specifier of imports) {
        if (
          directory.startsWith("src/game") &&
          !["immer", "zod"].includes(specifier) &&
          !specifier.startsWith("./")
        )
          throw new Error(`Gameplay boundary violation in ${file}: ${specifier}`);
        if (
          directory.startsWith("src/game") &&
          specifier.startsWith(".") &&
          !path.resolve(directory, specifier).startsWith(path.resolve("src/game") + path.sep)
        )
          throw new Error(`Gameplay escapes its owner in ${file}`);
        if (directory.startsWith("src/platform") && specifier.includes("/ui/"))
          throw new Error(`Platform imports UI: ${file}`);
      }
      if (
        directory.startsWith("src/game") &&
        /\b(?:window|document|localStorage|Math\.random|Date\.now)\b/.test(source)
      )
        throw new Error(`Nondeterministic or browser API in ${file}`);
    }
  }
}
await walk("src");
console.log("Architecture boundaries passed.");
