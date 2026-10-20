import { fork } from "node:child_process";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, runtime, identity, hash, reportDirectory } from "./lib/tool-runtime.mjs";
import { compareBalance } from "./lib/paired-balance.mjs";
const load = async (file) => JSON.parse(await readFile(path.resolve(file), "utf8"));
export async function worker(input, output) {
  const server = await runtime();
  try {
    const config = await load(input);
    const { balanceCase, BALANCE_CONFIG } = await server.ssrLoadModule("/src/application/balance.ts");
    const result = await balanceCase(config, await identity(), undefined, (record) =>
      appendFile(`${output}.journal.jsonl`, JSON.stringify(record) + "\n"),
    );
    await writeFile(output, JSON.stringify({ ...result, settings: BALANCE_CONFIG }));
  } finally {
    await server.close();
  }
}
function runWorker(input, output, timeout) {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(ROOT, "scripts/balance-compare.mjs"), ["--worker", input, output], {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    const stop = () => child.kill();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Incomplete: case watchdog exhausted."));
    }, timeout);
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
      if (code === 0) resolve();
      else reject(new Error(`Incomplete: case worker exited ${code}.`));
    });
  });
}
export async function main(args = process.argv.slice(2)) {
  if (args[0] === "--worker") return worker(args[1], args[2]);
  const mode = args.shift();
  if (mode === "compare") {
    const baseline = await load(args[0]),
      treatment = await load(args[1]);
    const comparison = compareBalance(baseline, treatment);
    const out = await reportDirectory(args[2], `reports/balance/comparison-${Date.now()}`);
    await writeFile(path.join(out, "comparison.json"), JSON.stringify(comparison, null, 2));
    console.log(JSON.stringify(comparison.metrics, null, 2));
    console.log(`Evidence: ${out}`);
    return;
  }
  if (mode === "replay") {
    const record = await load(args[0]);
    const server = await runtime();
    try {
      if (record.identity !== (await identity())) throw new Error("Replay code/content identity differs.");
      if (record.config.checkpoint) {
        const { balanceCase } = await server.ssrLoadModule("/src/application/balance.ts");
        await balanceCase(record.config, record.identity, record.replay);
      } else {
        const { runJourney } = await server.ssrLoadModule("/src/application/playthrough.ts");
        await runJourney(record.replay.config, record.identity, record.replay.initial, record.replay);
      }
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
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (
      !["--starters", "--seeds", "--out", "--checkpoint", "--loadouts"].includes(args[i]) ||
      !args[i + 1] ||
      Object.hasOwn(options, args[i])
    )
      throw new Error(`Invalid option: ${args[i]}`);
    options[args[i]] = args[i + 1];
  }
  const out = await reportDirectory(options["--out"], `reports/balance/${mode}-${Date.now()}`);
  const code = await identity();
  const report = {
    format: 1,
    kind: mode === "run" ? "career" : "experiment",
    identity: code,
    complete: false,
    settings: null,
    cases: [],
    failures: [],
  };
  const manifest = path.join(out, "report.json");
  await writeFile(manifest, JSON.stringify(report));
  const deadline = Date.now() + 15 * 60_000;
  let configs;
  if (mode === "run") {
    if (options["--checkpoint"] || options["--loadouts"])
      throw new Error("Use experiment for checkpoint loadouts.");
    const starters = (options["--starters"] ?? "mossback,emberfox,stormfin,silkmoth,briartooth").split(",");
    const seeds = (options["--seeds"] ?? "0,1,2,3,4,5,6,7,8,9").split(",").map(Number);
    if (
      new Set(starters).size !== starters.length ||
      new Set(seeds).size !== seeds.length ||
      starters.length > 5 ||
      seeds.length > 10 ||
      seeds.some((s) => !Number.isSafeInteger(s) || s < 0 || s > 0xffffffff)
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
    if (!loadouts.baseline || !loadouts.treatment)
      throw new Error("Provide baseline and treatment talent/relic lists.");
    configs = ["baseline", "treatment"].map((arm) => ({
      key: "battle",
      arm,
      config: {
        checkpoint,
        seed: JSON.parse(checkpoint).rng,
        starter: JSON.parse(checkpoint).roster[0],
        loadout: loadouts[arm],
      },
    }));
  }
  for (let i = 0; i < configs.length; i++) {
    const { key, config, arm } = configs[i];
    const input = path.join(out, `case-${i}-config.json`),
      output = path.join(out, `case-${i}.json`);
    await writeFile(input, JSON.stringify(config));
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error("Suite deadline exhausted.");
      await runWorker(input, output, Math.min(60_000, remaining));
      const result = await load(output);
      await writeFile(output, JSON.stringify({ ...result, config, identity: code }));
      report.settings = result.settings;
      report.cases.push({
        key,
        arm,
        complete: result.complete,
        reason: result.reason,
        baseHash: hash(result.base),
        initialHash: hash(result.initial),
        metrics: result.metrics,
        fixtureGrants: config.loadout ?? null,
        evidence: output,
      });
      if (!result.complete) report.failures.push({ key, reason: result.reason });
    } catch (error) {
      report.failures.push({ key, reason: error.message, config: input, journal: `${output}.journal.jsonl` });
    }
    await writeFile(manifest, JSON.stringify(report, null, 2));
  }
  report.complete = report.failures.length === 0 && report.cases.length === configs.length;
  await writeFile(manifest, JSON.stringify(report, null, 2));
  if (mode === "experiment" && report.complete) {
    const split = (arm) => ({ ...report, cases: report.cases.filter((row) => row.arm === arm) });
    await writeFile(
      path.join(out, "comparison.json"),
      JSON.stringify(compareBalance(split("baseline"), split("treatment")), null, 2),
    );
  }
  console.log(
    `${report.complete ? "Complete" : "Incomplete"}: ${report.cases.length}/${configs.length} cases. ${manifest}`,
  );
  if (!report.complete) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
