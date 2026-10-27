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
  const owners = bindings.flatMap((entry) =>
    entry.handlers.map((handler) => {
      const [module, name] = handler.split("#");
      const file = `src/game/${module.slice(2)}.ts`;
      const lines = readFileSync(path.join(root, file), "utf8").split("\n");
      const index = lines.findIndex((line) =>
        new RegExp(`\\b(?:function\\s*\\*?|const|let)\\s+${name}\\b`).test(line),
      );
      return { contract: entry.contract, handler, location: index < 0 ? file : `${file}:${index + 1}` };
    }),
  );
  const definitions = matches.filter(
    (file) => file.startsWith("src/game/content/") || file.startsWith("src/game/rules/"),
  );
  const tests = matches.filter(
    (file) =>
      /^tests\/(?:unit|integration|e2e|exhaustive)\//.test(file) && !file.startsWith("tests/unit/tooling/"),
  );
  return { id, bindings, owners, definitions, tests, matches };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error("Usage: npm run modifier:lookup -- <exact-id>");
  const result = lookupModifier(process.cwd(), process.argv[2]);
  console.log(`${result.id}\nDeclared execution and query owners (binding order is not reaction order):`);
  for (const owner of result.owners) console.log(`  ${owner.contract}: ${owner.handler} (${owner.location})`);
  console.log(
    `Definition and parameter references (literal hints):\n${result.definitions.map((file) => `  ${file}`).join("\n") || "  none"}`,
  );
  console.log(
    `Behavior test references (literal hints):\n${result.tests.map((file) => `  ${file}`).join("\n") || "  none"}`,
  );
  console.log(
    `Other literal references (navigation hints; indirect consumers may be missing):\n${
      result.matches
        .filter((file) => !result.definitions.includes(file) && !result.tests.includes(file))
        .map((file) => `  ${file}`)
        .join("\n") || "  none"
    }`,
  );
}
