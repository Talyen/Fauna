import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, open, readdir, unlink } from "node:fs/promises";
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
  if (
    options["--replay"] &&
    ["--seed", "--runs", "--starter", "--policy", "--save"].some((flag) => options[flag])
  )
    throw new Error("Replay cannot be combined with scenario or save options.");
  for (const [flag, minimum, maximum] of [
    ["--seed", 0, 0xffffffff],
    ["--runs", 1, 20],
  ]) {
    const value = options[flag];
    if (
      value !== undefined &&
      (!/^\d+$/u.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) < minimum ||
        Number(value) > maximum)
    )
      throw new Error(`Invalid playthrough value: ${flag}`);
  }
  if (options["--policy"] !== undefined && !["heuristic", "random"].includes(options["--policy"]))
    throw new Error("Invalid playthrough policy.");
  return options;
}

/** Admit only one writer and never replace earlier or interrupted evidence. */
export async function reservePlaythroughDirectory(directory) {
  const marker = path.join(directory, ".playthrough-writing");
  let handle;
  try {
    handle = await open(marker, "wx");
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("Choose an empty playthrough output directory; existing evidence is preserved.");
    throw error;
  }
  const release = async () => {
    await handle.close();
    await unlink(marker);
  };
  try {
    if ((await readdir(directory)).some((name) => name !== ".playthrough-writing"))
      throw new Error("Choose an empty playthrough output directory; existing evidence is preserved.");
  } catch (error) {
    await release();
    throw error;
  }
  return release;
}

/** Comparisons retain code changes, but must use the same scenario and policy. */
export function validatePlaythroughComparison(baseline, bundle, config) {
  if (
    baseline?.format !== 4 ||
    bundle?.format !== 4 ||
    baseline.complete !== true ||
    bundle.complete !== true ||
    typeof baseline.identity !== "string" ||
    !baseline.identity.trim() ||
    typeof bundle.identity !== "string" ||
    !bundle.identity.trim() ||
    !Number.isSafeInteger(baseline.policyVersion) ||
    baseline.policyVersion < 1 ||
    baseline.policyVersion !== bundle.policyVersion ||
    typeof baseline.initial !== "string" ||
    !baseline.initial.trim() ||
    baseline.initial !== bundle.initial ||
    !config ||
    !isDeepStrictEqual(baseline.config, config) ||
    !isDeepStrictEqual(bundle.config, config)
  )
    throw new Error(
      "Comparison needs completed, matched starting scenarios and policies with source identities.",
    );
}

export function validatePlaythroughReplay(replay, identity, policyVersion) {
  if (
    !replay ||
    replay.format !== 4 ||
    replay.identity !== identity ||
    replay.policyVersion !== policyVersion ||
    typeof replay.initial !== "string" ||
    !replay.initial.trim() ||
    !replay.config ||
    !Array.isArray(replay.steps) ||
    replay.steps.length > 5000
  )
    throw new Error("Invalid replay journal or content/build identity mismatch.");
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

export async function runPlaythroughWorker(args, { createServer, readIdentity = sourceIdentity } = {}) {
  const options = parsePlaythroughArgs(args);
  const profile =
    process.env.FAUNA_PLAYTHROUGH_PROFILE === "1"
      ? { stages: {}, journalMs: 0, journalRecords: 0 }
      : undefined;
  let checkpoint = performance.now();
  const mark = (name) => {
    const now = performance.now();
    if (profile) profile.stages[name] = now - checkpoint;
    checkpoint = now;
  };
  createServer ??= (await import("vite")).createServer;
  const server = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
  });
  mark("viteSetupMs");
  let journal, releaseOutput;
  try {
    const value = (name, fallback) => options[name] ?? fallback;
    const identity = await readIdentity();
    mark("identityMs");
    const { runJourney } = await server.ssrLoadModule("/src/tooling/playthrough.ts");
    const { FIRST_RUN_STARTERS } = await server.ssrLoadModule("/src/game/content.ts");
    mark("moduleLoadMs");
    const replay = value("--replay") ? JSON.parse(await readFile(value("--replay"), "utf8")) : undefined;
    const { BATTLE_POLICY_VERSION } = await server.ssrLoadModule("/src/application/battle-policy.ts");
    if (replay !== undefined) validatePlaythroughReplay(replay, identity, BATTLE_POLICY_VERSION);
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
    const baseline = value("--compare") ? JSON.parse(await readFile(value("--compare"), "utf8")) : undefined;
    const { createGame } = await server.ssrLoadModule("/src/game/engine.ts");
    const { decodeSave } = await server.ssrLoadModule("/src/game/save.ts");
    const initial =
      replay?.initial ??
      (value("--save") ? await readFile(value("--save"), "utf8") : JSON.stringify(createGame(config.seed)));
    decodeSave(initial);
    if (baseline !== undefined)
      validatePlaythroughComparison(
        baseline,
        {
          format: 4,
          complete: true,
          identity,
          policyVersion: BATTLE_POLICY_VERSION,
          initial,
          config,
        },
        config,
      );
    const output = await reportDirectory(value("--out"), "reports/playthrough");
    releaseOutput = await reservePlaythroughDirectory(output);
    const journalPath = path.join(output, `journal-${randomUUID()}.jsonl`);
    journal = await open(journalPath, "a");
    const appendRecord = async (record) => {
      const started = performance.now();
      // Every record is still awaited before the next command; keep no user-space batch buffer.
      await journal.appendFile(JSON.stringify(record) + "\n");
      if (profile) {
        profile.journalMs += performance.now() - started;
        profile.journalRecords++;
      }
    };
    await appendRecord({ type: "initial", identity, config, initial });
    await writeFile(
      path.join(output, "summary.json"),
      JSON.stringify({
        complete: false,
        reason: "Run in progress or interrupted",
        journal: path.basename(journalPath),
      }),
    );
    console.log(`Journal: ${journalPath}`);
    mark("fixtureSetupMs");
    const bundle = await runJourney(config, identity, initial, replay, appendRecord);
    mark("journeyMs");
    if ((await readIdentity()) !== identity)
      throw new Error("Playthrough source changed during execution; evidence is incomplete.");
    await writeFile(path.join(output, "journey.json"), JSON.stringify(bundle));
    if (baseline !== undefined) validatePlaythroughComparison(baseline, bundle, config);
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
      profile,
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
    try {
      await journal?.close();
    } finally {
      try {
        await releaseOutput?.();
      } finally {
        await server.close();
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.at(-1) === "--worker") await runPlaythroughWorker(args.slice(0, -1));
  else {
    try {
      await runPlaythrough(args);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
