import { randomUUID } from "node:crypto";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runOwnedWorker } from "../lib/worker.mjs";
import { identity as sourceIdentity, reportDirectory } from "../lib/tool-runtime.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export function parsePlaythroughArgs(args) {
  const options = {};
  const allowed = new Set([
    "--seed",
    "--runs",
    "--starter",
    "--policy",
    "--out",
    "--save",
    "--replay",
    "--compare",
  ]);
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index],
      value = args[index + 1];
    if (!allowed.has(flag) || !value || value.startsWith("--") || Object.hasOwn(options, flag))
      throw new Error(`Invalid or duplicate playthrough option: ${flag}`);
    options[flag] = value;
  }
  return options;
}

export async function runPlaythrough(args, { timeout = 60_000, spawnWorker } = {}) {
  parsePlaythroughArgs(args);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    await runOwnedWorker(fileURLToPath(import.meta.url), [...args, "--worker"], timeout, {
      signal: controller.signal,
      spawnWorker,
    });
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}

async function worker(args) {
  const options = parsePlaythroughArgs(args);
  const { createServer } = await import("vite");
  const server = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
  });
  try {
    const value = (name, fallback) => options[name] ?? fallback;
    const identity = await sourceIdentity();
    const { runJourney } = await server.ssrLoadModule("/src/tooling/playthrough.ts");
    const { FIRST_RUN_STARTERS } = await server.ssrLoadModule("/src/game/content.ts");
    const replay = value("--replay") ? JSON.parse(await readFile(value("--replay"), "utf8")) : undefined;
    const config = replay?.config ?? {
      seed: Number(value("--seed", 42)),
      runs: Number(value("--runs", 2)),
      starter: value("--starter", "emberback"),
      policy: value("--policy", "heuristic"),
      maxActions: 5000,
      maxTurns: 100,
      resumeEvery: 17,
    };
    if (
      !Number.isInteger(config.seed) ||
      config.seed < 0 ||
      config.seed > 0xffffffff ||
      !Number.isInteger(config.runs) ||
      config.runs < 1 ||
      config.runs > 20 ||
      !["heuristic", "random"].includes(config.policy) ||
      !FIRST_RUN_STARTERS.includes(config.starter)
    )
      throw new Error("Invalid scenario configuration.");
    const output = await reportDirectory(value("--out"), "reports/playthrough");
    const baseline = value("--compare") ? JSON.parse(await readFile(value("--compare"), "utf8")) : undefined;
    const journalPath = path.join(output, `journal-${randomUUID()}.jsonl`);
    const { createGame } = await server.ssrLoadModule("/src/game/engine.ts");
    const initial =
      replay?.initial ??
      (value("--save") ? await readFile(value("--save"), "utf8") : JSON.stringify(createGame(config.seed)));
    await appendFile(journalPath, JSON.stringify({ type: "initial", identity, config, initial }) + "\n");
    await writeFile(
      path.join(output, "summary.json"),
      JSON.stringify({
        complete: false,
        reason: "Run in progress or interrupted",
        journal: path.basename(journalPath),
      }),
    );
    console.log(`Journal: ${journalPath}`);
    const bundle = await runJourney(config, identity, initial, replay, (record) =>
      appendFile(journalPath, JSON.stringify(record) + "\n"),
    );
    await writeFile(path.join(output, "journey.json"), JSON.stringify(bundle));
    if (
      baseline &&
      (!baseline.complete ||
        !bundle.complete ||
        JSON.stringify(baseline.config) !== JSON.stringify(config) ||
        baseline.initial !== bundle.initial)
    )
      throw new Error("Comparison needs completed, matched starting scenarios and policies.");
    const summary = {
      complete: bundle.complete,
      reason: bundle.reason,
      diagnostics: bundle.diagnostics,
      identity,
      policyVersion: bundle.policyVersion,
      config,
      actions: bundle.steps.length,
      results: bundle.results,
      battles: bundle.battles,
      milestones: bundle.milestones,
      journal: path.basename(journalPath),
      comparison: baseline
        ? {
            baselineIdentity: baseline.identity,
            codeChanged: baseline.identity !== identity,
            results: baseline.results,
          }
        : undefined,
      limitations:
        "Automated visible-information policy; no rendering, listening, or human balance acceptance.",
    };
    await writeFile(path.join(output, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    if (!bundle.complete) process.exitCode = 1;
  } finally {
    await server.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.at(-1) === "--worker") await worker(args.slice(0, -1));
  else {
    try {
      await runPlaythrough(args);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
