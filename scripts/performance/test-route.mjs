import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { routeArguments } from "./routes.mjs";
try {
  const [name, ...extras] = process.argv.slice(2);
  const args = routeArguments(name, extras);
  console.log(`Browser route ${name}: ${args.join(" ")}`);
  // Resolve the JS entrypoint so Windows needs neither a shell nor a .cmd launcher.
  const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
  const result = spawnSync(process.execPath, [cli, ...args.slice(1)], {
    stdio: "inherit",
    shell: false,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
