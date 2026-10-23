import { runInvestigation } from "./investigation-process.mjs";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { npmCommand } from "../lib/npm-command.mjs";
import { selectPaths } from "./agent-review.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Bounded diagnostics for a concrete task failure; ordinary completion uses verify. */
export function investigationArgs(root, args) {
  const [kind, ...inputs] = args;
  if (["types", "static", "build"].includes(kind) && !inputs.length)
    return ["run", { types: "check:types", static: "check:full", build: "build" }[kind]];
  if (kind === "unit" && inputs.length) {
    const files = selectPaths(root, inputs);
    if (
      files.some(
        (file) =>
          !/^tests\/(?:unit|integration)\/.+\.test\.(?:[cm]?[jt]sx?)$/.test(file) ||
          !existsSync(path.join(root, file)),
      )
    )
      throw new Error("Choose existing unit/integration suite files.");
    return ["run", "test:full", "--", "--maxWorkers=1", "--no-file-parallelism", ...files];
  }
  if (
    kind === "browser" &&
    inputs.length === 1 &&
    ["battle", "settings", "collection", "progression", "persistence"].includes(inputs[0])
  )
    return ["run", "test:e2e:route", "--", inputs[0]];
  if (kind === "performance" && inputs.length === 1 && ["battle", "swap", "menus"].includes(inputs[0]))
    return ["run", "perf", "--", "--scenario", inputs[0]];
  throw new Error(
    "Usage: npm run verify -- --diagnostic types|static|build|unit <suite files>|browser <route>|performance <battle|swap|menus>",
  );
}

export async function investigate(
  args = process.argv.slice(2),
  { root = ROOT, runner = runInvestigation } = {},
) {
  const argv = investigationArgs(root, args);
  const [command, commandArgs] = npmCommand(argv);
  let preview;
  const env = {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=2048`.trim(),
    RAYON_NUM_THREADS: "1",
  };
  try {
    if (args[0] === "browser") {
      if (!existsSync(path.join(root, "dist/index.html")))
        throw new Error("Build this task first with npm run verify -- --diagnostic build.");
      const { preview: start } = await import("vite");
      preview = await start({ root, preview: { host: "127.0.0.1", port: 0, strictPort: true, open: false } });
      env.FAUNA_TEST_URL = `http://127.0.0.1:${preview.httpServer.address().port}`;
    }
    const result = await runner(command, commandArgs, { cwd: root, stdio: "inherit", timeout: 300_000, env });
    if (result.error) console.error(`Bounded investigation could not finish: ${result.error.message}`);
    return result.error ? 1 : (result.status ?? 1);
  } finally {
    if (preview) {
      preview.httpServer.closeAllConnections();
      await new Promise((resolve, reject) =>
        preview.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  process.exitCode = await investigate();
