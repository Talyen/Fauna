import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { git } from "../lib/git.mjs";
import { modifierBindings } from "../checks/modifier-contracts.mjs";

/** Binding declarations are authoritative; literal matches are navigation hints. */
export function lookupModifier(root, id) {
  if (!id || !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(id))
    throw new Error("Provide one exact modifier ID or passive kind.");
  const bindings = modifierBindings(
    readFileSync(path.join(root, "src/game/modifier-bindings.ts"), "utf8"),
    id,
  );
  if (!bindings.length) throw new Error(`No binding found for ${id}. Check the exact ID or passive kind.`);
  const files = git(root, [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    "src/game",
    "tests",
  ])
    .split("\0")
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && file !== "src/game/modifier-bindings.ts");
  const matches = [];
  for (const file of new Set(files)) {
    let source;
    try {
      source = readFileSync(path.join(root, file), "utf8");
    } catch {
      continue;
    }
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index++) {
      if ([`"${id}"`, `'${id}'`, `\`${id}\``].some((literal) => lines[index].includes(literal)))
        matches.push(`${file}:${index + 1}`);
    }
  }
  return { id, bindings, matches };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error("Usage: npm run modifier:lookup -- <exact-id>");
  const result = lookupModifier(process.cwd(), process.argv[2]);
  console.log(`${result.id}\nDeclared owners:`);
  for (const entry of result.bindings)
    console.log(`  ${entry.contract}/${entry.group}: ${entry.handlers.join(", ")}`);
  console.log(
    `Literal references (navigation hints; inspect tests and indirect consumers):\n${result.matches.map((file) => `  ${file}`).join("\n") || "  none"}`,
  );
}
