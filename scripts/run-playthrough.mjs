import { fork } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (!args.includes("--worker")) {
  const child = fork(fileURLToPath(import.meta.url), [...args, "--worker"], { stdio: "inherit" });
  process.once("SIGINT", () => child.kill());
  process.once("SIGTERM", () => child.kill());
  const timer = setTimeout(() => {
    child.kill();
    console.error("Incomplete: playthrough exceeded 60-second watchdog.");
    process.exitCode = 1;
  }, 60_000);
  child.once("exit", (code) => {
    clearTimeout(timer);
    process.exitCode = code ?? 1;
  });
} else {
  const { createServer } = await import("vite");
  const server = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
  });
  try {
    const value = (name, fallback) => {
      const index = args.indexOf(name);
      return index < 0 ? fallback : args[index + 1];
    };
    const allowed = new Set([
      "--seed",
      "--runs",
      "--starter",
      "--policy",
      "--out",
      "--save",
      "--replay",
      "--compare",
      "--worker",
    ]);
    for (let index = 0; index < args.length; index++) {
      if (!allowed.has(args[index])) throw new Error(`Unknown option ${args[index]}`);
      if (args[index] !== "--worker") index++;
    }
    const hash = createHash("sha256");
    async function fingerprint(directory) {
      for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await fingerprint(file);
        else if (entry.name.endsWith(".ts")) {
          hash.update(path.relative(root, file));
          hash.update(await readFile(file));
        }
      }
    }
    await fingerprint(path.join(root, "src/game"));
    await fingerprint(path.join(root, "src/application"));
    const identity = hash.digest("hex");
    const { runJourney } = await server.ssrLoadModule("/src/application/playthrough.ts");
    const replay = value("--replay") ? JSON.parse(await readFile(value("--replay"), "utf8")) : undefined;
    const config = replay?.config ?? {
      seed: Number(value("--seed", 42)),
      runs: Number(value("--runs", 2)),
      starter: value("--starter", "emberfox"),
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
      !["mossback", "emberfox", "stormfin", "silkmoth", "briartooth", "moonhart"].includes(config.starter)
    )
      throw new Error("Invalid scenario configuration.");
    const output = path.resolve(root, value("--out", "reports/playthrough"));
    if (!output.startsWith(path.join(root, "reports") + path.sep))
      throw new Error("Reports must stay under reports/.");
    await mkdir(output, { recursive: true });
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
      identity,
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
