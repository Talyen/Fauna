import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { runInvestigation } from "./agent/investigation-process.mjs";
import { npmCommand } from "./lib/npm-command.mjs";
import { ensureDependencies } from "./dependencies.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

export function localCommands(kind, args, { root = ROOT, ci = false } = {}) {
  const node = (file, ...argv) => [process.execPath, [path.resolve(root, file), ...argv]];
  const npm = (name, ...argv) => npmCommand(["run", name, ...(argv.length ? ["--", ...argv] : [])]);
  const unit = !ci ? ["--maxWorkers=1", "--no-file-parallelism"] : [];
  const commands = {
    integrate: () => [node("scripts/integrate.mjs", ...args)],
    test: () => [node("node_modules/vitest/vitest.mjs", "run", ...args, ...unit)],
    "verify:changed": () => [node("scripts/checks/check.mjs", ...args)],
    build: () => [node("node_modules/vite/bin/vite.js", "build", ...args), npm("generate:release-inventory")],
    "check:types": () => [node("scripts/checks/typecheck.mjs", ...args)],
    "check:lint": () => {
      // Both the CLI and its type-aware backend are required. Explicit resolution
      // also keeps these command-only dependencies visible to unused-code checks.
      require.resolve("oxlint-tsgolint/package.json");
      return [
        node(
          path.join(path.dirname(require.resolve("oxlint/package.json")), "bin/oxlint"),
          "--type-aware",
          "src",
          "tests",
          "scripts",
          "desktop",
          "design",
          "--deny-warnings",
          ...args,
        ),
      ];
    },
    "check:format": () => [node("node_modules/prettier/bin/prettier.cjs", "--check", ".", ...args)],
    "check:boundaries": () => [
      node("scripts/checks/boundaries.mjs", ...args),
      node("scripts/checks/ui-contract.mjs"),
    ],
    deadcode: () => [node("node_modules/knip/bin/knip.js", "--treat-config-hints-as-errors", ...args)],
    "test:e2e": () => [
      node("node_modules/@playwright/test/cli.js", "test", ...args, ...(!ci ? ["--workers=1"] : [])),
    ],
    "check:full": () =>
      ["check:types", "check:lint", "check:format", "check:boundaries", "deadcode"].map((name) =>
        npm(name, ...args),
      ),
    "verify:full": () => [
      ...["check:full", "docs:check", "content:audit"].map((name) => npm(name)),
      npm("test:full", "--reporter=default", "--reporter=json", "--outputFile.json=reports/vitest.json"),
      ...["build", "check:bundle", "assets:check:bundle", "test:e2e"].map((name) => npm(name)),
    ],
  };
  if (!commands[kind]) throw new Error(`Unknown local command: ${kind}`);
  return commands[kind]();
}

export async function runLocal(
  kind,
  args = [],
  { root = ROOT, env = process.env, runner = runInvestigation } = {},
) {
  const ci = env.CI === "true";
  const bounded = !ci && env.FAUNA_COMMAND_BUDGET !== "1";
  const deadline = Date.now() + 300_000;
  const childEnv = {
    ...env,
    ...(!ci
      ? {
          NODE_OPTIONS: `${env.NODE_OPTIONS ?? ""} --max-old-space-size=2048`.trim(),
          RAYON_NUM_THREADS: "1",
          FAUNA_COMMAND_BUDGET: "1",
        }
      : {}),
  };
  const status = ensureDependencies(root, { env: childEnv });
  if (status !== 0) return status;
  // Nested npm recipes share the outer deadline and process group.
  for (const [command, argv] of localCommands(kind, args, { root, ci })) {
    const result = await runner(command, argv, {
      cwd: root,
      stdio: "inherit",
      env: childEnv,
      ...(bounded ? { timeout: Math.max(1, deadline - Date.now()) } : {}),
      grouped: bounded,
    });
    if (result.error) console.error(result.error.message);
    if (result.error || result.status !== 0) return result.status || 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.exitCode = await runLocal(process.argv[2], process.argv.slice(3));
