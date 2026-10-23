import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { git } from "../lib/git.mjs";
import { npmCommand } from "../lib/npm-command.mjs";

export function restoreVercelConfig(root, env = process.env) {
  if (env.VERCEL !== "1") throw new Error("This build entrypoint is only for hosted Vercel builds.");
  const file = path.join(root, "vercel.json");
  const committed = git(root, ["show", "HEAD:vercel.json"]);
  const current = readFileSync(file, "utf8");
  if (JSON.stringify(JSON.parse(current)) !== JSON.stringify(JSON.parse(committed)))
    throw new Error("Vercel build configuration differs from the committed configuration.");
  // Vercel minifies this file before building; restore only equivalent formatting.
  if (current !== committed) writeFileSync(file, committed);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(import.meta.dirname, "../..");
  restoreVercelConfig(root);
  for (const script of ["check:types", "build"]) {
    const [command, args] = npmCommand(["run", script]);
    const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
    if (result.error || result.status !== 0) {
      if (result.error) console.error(result.error.message);
      process.exitCode = result.status || 1;
      break;
    }
  }
}
