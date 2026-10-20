import { spawnSync } from "node:child_process";
import { routeArguments } from "./lib/test-routes.mjs";
try {
  const [name, ...extras] = process.argv.slice(2);
  const args = routeArguments(name, extras);
  console.log(`Browser route ${name}: ${args.join(" ")}`);
  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
