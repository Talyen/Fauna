import path from "node:path";
import { pathToFileURL } from "node:url";
import { constants, setPriority } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");

export function runLocalTests({ root = ROOT, runner = spawnSync } = {}) {
  const result = runner(
    process.execPath,
    [path.join(root, "node_modules/vitest/vitest.mjs"), "run", "--config", "vitest.local.config.mjs"],
    {
      cwd: root,
      stdio: "inherit",
      timeout: 30_000,
      killSignal: "SIGTERM",
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=512`.trim(),
        RAYON_NUM_THREADS: "1",
      },
    },
  );
  if (result.error) console.error(`Local smoke could not finish: ${result.error.message}`);
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length > 2)
    throw new Error("Local smoke is fixed. Use npm run test:full -- <paths> for focused unit tests.");
  try {
    setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {
    // Some hosts disallow priority changes; the worker, heap and deadline limits still apply.
  }
  console.log("Local Node smoke only. Full unit and DOM validation belongs to CI.");
  process.exitCode = runLocalTests();
}
