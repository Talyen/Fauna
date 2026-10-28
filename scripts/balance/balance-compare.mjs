import { readFile, writeFile, appendFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, runtime, identity, hash, reportDirectory } from "../lib/tool-runtime.mjs";
import { runOwnedWorker } from "../lib/worker.mjs";
import { isDeepStrictEqual } from "node:util";
import { reserveBalanceDirectory } from "./report-directory.mjs";
export { reserveBalanceDirectory } from "./report-directory.mjs";
import { compareBalance, validateBalanceMetrics } from "./paired-balance.mjs";
import { writeBalanceFindings } from "./balance-findings.mjs";
import { pruneBalanceReports, sealBalanceReport } from "./report-retention.mjs";
const load = async (file) => JSON.parse(await readFile(path.resolve(file), "utf8"));

export function parseBalanceOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (
      !["--starters", "--seeds", "--out", "--checkpoint", "--loadouts", "--evidence"].includes(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--") ||
      Object.hasOwn(options, args[i])
    )
      throw new Error(`Invalid option: ${args[i]}`);
    options[args[i]] = args[i + 1];
  }
  return options;
}

export function parseBalanceSeeds(value) {
  const parts = value.split(",");
  if (parts.some((part) => !/^\d+$/u.test(part))) throw new Error("Invalid or excessive suite.");
  const seeds = parts.map(Number);
  if (
    seeds.length > 10 ||
    new Set(seeds).size !== seeds.length ||
    seeds.some((seed) => !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
  )
    throw new Error("Invalid or excessive suite.");
  return seeds;
}
export function experimentConfigs(checkpoint, loadouts) {
  const state = JSON.parse(checkpoint);
  if (
    state?.phase !== "battle" ||
    !Number.isSafeInteger(state.rng) ||
    state.rng < 0 ||
    state.rng > 0xffffffff ||
    !Array.isArray(state.team) ||
    typeof state.team[0]?.species !== "string" ||
    !state.team[0].species
  )
    throw new Error("Experiment requires a current battle checkpoint with a deployed creature.");
  for (const arm of ["baseline", "treatment"]) {
    const loadout = loadouts?.[arm];
    if (
      !loadout ||
      ![loadout.talents, loadout.boons].every(
        (ids) =>
          Array.isArray(ids) &&
          new Set(ids).size === ids.length &&
          ids.every((id) => typeof id === "string" && id.trim().length > 0 && id === id.trim()),
      )
    )
      throw new Error("Provide baseline and treatment talent/boon ID arrays.");
  }
  return ["baseline", "treatment"].map((arm) => ({
    key: "battle",
    arm,
    config: { checkpoint, seed: state.rng, starter: state.team[0].species, loadout: loadouts[arm] },
  }));
}
export async function worker(input, output) {
  if (!output || !path.resolve(output).startsWith(path.join(ROOT, "reports") + path.sep))
    throw new Error("Worker reports must remain under reports/.");
  await reportDirectory(path.dirname(path.resolve(output)));
  const code = await identity();
  const server = await runtime();
  try {
    const config = await load(input);
    const { balanceCase, BALANCE_CONFIG } = await server.ssrLoadModule("/src/tooling/balance.ts");
    const result = await balanceCase(config, code, undefined, (record) =>
      appendFile(`${output}.journal.jsonl`, JSON.stringify(record) + "\n"),
    );
    const unchanged = code === (await identity());
    await writeFile(
      output,
      JSON.stringify({
        ...result,
        ...(unchanged ? {} : { complete: false, reason: "Source identity changed during the case." }),
        identity: code,
        settings: BALANCE_CONFIG,
      }),
    );
  } finally {
    await server.close();
  }
}
export function runWorker(input, output, timeout, options) {
  return runOwnedWorker(
    path.join(ROOT, "scripts/balance/balance-compare.mjs"),
    ["--worker", input, output],
    timeout,
    options,
  );
}
export async function main(
  args = process.argv.slice(2),
  { runCase = runWorker, sourceIdentity = identity, pruneReports = pruneBalanceReports } = {},
) {
  if (args[0] === "--worker") return worker(args[1], args[2]);
  const mode = args.shift();
  if (mode === "compare") {
    if (args.length < 2 || args.length > 3 || args.some((arg) => arg.startsWith("--")))
      throw new Error("Usage: balance:compare -- compare baseline.json treatment.json [out]");
    const baseline = await load(args[0]),
      treatment = await load(args[1]);
    const comparison = compareBalance(baseline, treatment);
    const out = await reportDirectory(args[2], `reports/balance/comparison-${Date.now()}`);
    const release = await reserveBalanceDirectory(out);
    try {
      await writeFile(path.join(out, "comparison.json"), JSON.stringify(comparison, null, 2));
      await writeBalanceFindings(comparison, out);
    } finally {
      await release();
    }
    console.log(JSON.stringify(comparison.metrics, null, 2));
    console.log(`Evidence: ${out}`);
    return;
  }
  if (mode === "replay") {
    if (args.length !== 1 || args[0].startsWith("--"))
      throw new Error("Usage: balance:compare -- replay case.json");
    const record = await load(args[0]);
    if (!record.replay)
      throw new Error(
        "This case retains summary evidence only. Record with --evidence full for exact replay.",
      );
    const server = await runtime();
    try {
      if (record.identity !== (await identity())) throw new Error("Replay code/content identity differs.");
      let result;
      if (record.config.checkpoint) {
        const { balanceCase } = await server.ssrLoadModule("/src/tooling/balance.ts");
        result = await balanceCase(record.config, record.identity, record.replay);
      } else {
        const { runJourney } = await server.ssrLoadModule("/src/tooling/playthrough.ts");
        result = await runJourney(
          record.replay.config,
          record.identity,
          record.replay.initial,
          record.replay,
        );
      }
      if (!result.complete) throw new Error(`Incomplete balance replay: ${result.reason}`);
      console.log("Balance replay matched all checkpoints.");
    } finally {
      await server.close();
    }
    return;
  }
  if (!["run", "experiment"].includes(mode))
    throw new Error(
      "Usage: balance:compare -- run [--starters ids --seeds numbers --out directory] | compare baseline.json treatment.json [out] | experiment --checkpoint save.json --loadouts choices.json [--out directory] | replay case.json",
    );
  const options = parseBalanceOptions(args);
  const evidencePolicy = options["--evidence"] ?? "failures";
  if (!["failures", "full"].includes(evidencePolicy)) throw new Error("--evidence must be failures or full.");
  let configs;
  if (mode === "run") {
    if (options["--checkpoint"] || options["--loadouts"])
      throw new Error("Use experiment for checkpoint loadouts.");
    const starters = (options["--starters"] ?? "emberback,prismram,captoad,dunefox,cindernewt").split(",");
    const seeds = parseBalanceSeeds(options["--seeds"] ?? "0,1,2,3,4,5,6,7,8,9");
    if (
      starters.length > 5 ||
      new Set(starters).size !== starters.length ||
      starters.some((starter) => !/^[a-z][a-z0-9-]*$/u.test(starter))
    )
      throw new Error("Invalid or excessive suite.");
    configs = starters.flatMap((starter) =>
      seeds.map((seed) => ({ key: `${starter}-${seed}`, config: { starter, seed } })),
    );
  } else {
    if (!options["--checkpoint"] || !options["--loadouts"] || options["--starters"] || options["--seeds"])
      throw new Error("Experiment requires only --checkpoint and --loadouts.");
    const checkpoint = await readFile(path.resolve(options["--checkpoint"]), "utf8");
    const loadouts = await load(options["--loadouts"]);
    configs = experimentConfigs(checkpoint, loadouts);
  }
  await pruneReports(ROOT, { includeArchives: true });
  const out = await reportDirectory(options["--out"], `reports/balance/${mode}-${Date.now()}`);
  let release = await reserveBalanceDirectory(out);
  try {
    const code = await sourceIdentity();
    const report = {
      format: 1,
      kind: mode === "run" ? "career" : "experiment",
      identity: code,
      complete: false,
      settings: null,
      cases: [],
      failures: [],
      evidencePolicy,
    };
    const manifest = path.join(out, "report.json");
    await writeFile(manifest, JSON.stringify(report));
    const deadline = Date.now() + 15 * 60_000;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    process.once("SIGTERM", cancel);
    try {
      for (let i = 0; i < configs.length; i++) {
        if (controller.signal.aborted) break;
        const { key, config, arm } = configs[i];
        const input = path.join(out, `case-${i}-config.json`),
          output = path.join(out, `case-${i}.json`);
        await writeFile(input, JSON.stringify(config));
        try {
          const remaining = deadline - Date.now();
          if (remaining <= 0) throw new Error("Suite deadline exhausted.");
          await runCase(input, output, Math.min(60_000, remaining), { signal: controller.signal });
          const result = await load(output);
          if (result.identity !== code || (await sourceIdentity()) !== code)
            throw new Error("Source identity changed; case evidence is preserved.");
          if (typeof result.complete !== "boolean") throw new Error("Invalid case completion status.");
          if (!result.settings || typeof result.settings !== "object" || Array.isArray(result.settings))
            throw new Error("Invalid case settings.");
          if (report.settings !== null && !isDeepStrictEqual(report.settings, result.settings))
            throw new Error("Case settings differ; mixed settings cannot form a suite.");
          if (result.complete) validateBalanceMetrics(result.metrics, key);
          await writeFile(output, JSON.stringify({ ...result, config }));
          report.settings ??= result.settings;
          report.cases.push({
            key,
            starter: config.starter,
            actualStarter:
              result.replay.steps.find((step) => step.accepted && step.command.type === "draft")?.command
                .species ?? null,
            seed: config.seed,
            arm,
            complete: result.complete,
            reason: result.reason,
            diagnostics: result.diagnostics,
            baseHash: hash(result.base),
            initialHash: hash(result.initial),
            metrics: result.metrics,
            fixtureGrants: config.loadout ?? null,
            evidence: output,
          });
          if (!result.complete)
            report.failures.push({
              key,
              reason: result.reason,
              diagnostics: result.diagnostics,
              evidence: output,
              journal: `${output}.journal.jsonl`,
            });
          else if (evidencePolicy !== "full") {
            // The aggregate report owns comparison metrics. Keep a small case
            // record; successful replay checkpoints and the duplicate journal
            // are opt-in. Failed/interrupted workers retain their full evidence.
            await writeFile(
              output,
              JSON.stringify({
                complete: true,
                identity: code,
                config,
                settings: result.settings,
                metrics: result.metrics,
                diagnostics: result.diagnostics,
                replayRetained: false,
              }),
            );
            await rm(`${output}.journal.jsonl`, { force: true });
          }
        } catch (error) {
          report.failures.push({
            key,
            reason: error.message,
            config: input,
            journal: `${output}.journal.jsonl`,
          });
        }
        await writeFile(manifest, JSON.stringify(report, null, 2));
      }
    } finally {
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    }
    if ((await sourceIdentity()) !== code)
      report.failures.push({ key: "source-identity", reason: "Source identity changed during the suite." });
    report.complete =
      !controller.signal.aborted && report.failures.length === 0 && report.cases.length === configs.length;
    await writeFile(manifest, JSON.stringify(report, null, 2));
    await writeBalanceFindings(report, out);
    if (mode === "experiment" && report.complete) {
      const split = (arm) => ({ ...report, cases: report.cases.filter((row) => row.arm === arm) });
      const comparison = compareBalance(split("baseline"), split("treatment"));
      await writeFile(path.join(out, "comparison.json"), JSON.stringify(comparison, null, 2));
      await writeBalanceFindings(comparison, out);
    }
    console.log(
      `${report.complete ? "Complete" : "Incomplete"}: ${report.cases.length}/${configs.length} cases. ${manifest}`,
    );
    await release();
    release = undefined;
    await sealBalanceReport(out, report.complete, { root: ROOT });
    if (!report.complete) process.exitCode = 1;
  } finally {
    await release?.();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
