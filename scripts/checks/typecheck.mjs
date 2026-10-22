import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const compiler = path.join(path.dirname(require.resolve("typescript/package.json")), "bin/tsc");
for (const config of [
  "tsconfig.game.json",
  "tsconfig.json",
  "tsconfig.node.json",
  "tsconfig.test.json",
  "tsconfig.desktop.json",
]) {
  console.log(`Type checking ${config}`);
  const result = spawnSync(process.execPath, [compiler, "--noEmit", "-p", config], { stdio: "inherit" });
  if (result.status !== 0) process.exitCode = 1;
}
