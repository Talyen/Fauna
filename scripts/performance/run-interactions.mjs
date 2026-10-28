import { chromium } from "@playwright/test";
import { preview } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, runtime, identity, hash, reportDirectory } from "../lib/tool-runtime.mjs";
import {
  parseInteractionArgs,
  reserveInteractionReport,
  shrinkTrace,
  validateInteractionReport,
} from "../lib/interaction-replay.mjs";
import { action as battleAction } from "./run-performance.mjs";

const options = parseInteractionArgs(process.argv.slice(2));
const prior = options.replay
  ? validateInteractionReport(JSON.parse(await readFile(path.resolve(options.replay), "utf8")))
  : null;
const build = await identity();
if (prior && prior.identity !== build) throw new Error("Interaction replay code/content identity differs.");
const loader = await runtime();
let initial, dispatch, decodeSave, encodeSave, createBattleActor;
try {
  const perf = await loader.ssrLoadModule("/src/tooling/performance.ts");
  ({ dispatch } = await loader.ssrLoadModule("/src/game/engine.ts"));
  ({ decodeSave, encodeSave } = await loader.ssrLoadModule("/src/game/save.ts"));
  ({ createBattleActor } = await loader.ssrLoadModule("/src/application/battle-actor.ts"));
  initial = prior?.initial ?? perf.performanceCases()[0].initial;
  decodeSave(initial);
  const out = await reportDirectory(options.out, `reports/interactions/run-${Date.now()}`);
  const family = prior?.family ?? options.family;
  const report = {
    format: 1,
    identity: build,
    seed: prior?.seed ?? options.seed,
    family,
    initial,
    actions: [],
    ...(prior?.checkpointMode === "recompute" ? { checkpointMode: "recompute" } : {}),
    complete: false,
    failure: "Run in progress or interrupted",
    shrunk: null,
  };
  await reserveInteractionReport(out, report);
  const server = await preview({
    root: ROOT,
    preview: { host: "127.0.0.1", port: 0, strictPort: true, open: false },
  });
  const browser = await chromium.launch({ args: ["--mute-audio"] }).catch(async (error) => {
    await new Promise((resolve) => server.httpServer.close(resolve));
    throw error;
  });
  const url = `http://127.0.0.1:${server.httpServer.address().port}`;
  let rng = prior?.seed ?? options.seed;
  const pick = (items) => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return items[Math.floor((rng / 4294967296) * items.length)];
  };
  const kinds =
    family === "navigation"
      ? ["collection", "settings", "talents"]
      : family === "battle"
        ? ["battle"]
        : family === "persistence"
          ? ["reload", "battle"]
          : ["collection", "settings", "talents", "battle", "reload"];
  async function replay(trace, generate = false, captureCheckpoints = false) {
    const actor = createBattleActor();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: "reduce",
    });
    let state = decodeSave(initial),
      index = 0;
    try {
      await context.addInitScript((initial) => {
        if (!localStorage.getItem("fauna.save.v1")) localStorage.setItem("fauna.save.v1", initial);
        localStorage.setItem("fauna.auto-end-turn", "false");
      }, initial);
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(url);
      await page.getByRole("button", { name: "Continue", exact: true }).waitFor({ timeout: 30000 });
      for (index = 0; index < (generate ? options.steps : trace.length); index++) {
        const step = generate ? { kind: pick(kinds) } : structuredClone(trace[index]);
        if (generate && step.kind === "battle") step.command = actor.choose(state, false).command;
        let expected = state;
        if (step.kind === "battle") {
          const result = dispatch(state, step.command);
          if (!result.accepted || state.phase !== "battle") {
            if (generate) step.kind = "reload";
            else return { valid: false, failure: null };
          } else expected = decodeSave(encodeSave(result.state));
        }
        if (generate) report.actions.push(step); // Record attempted actions before touching rendered controls.
        if (step.kind === "reload") {
          await page.reload();
          await page.getByRole("button", { name: "Continue", exact: true }).waitFor({ timeout: 30000 });
        } else if (step.kind === "battle") {
          await page.getByRole("button", { name: "Continue", exact: true }).click();
          await battleAction(page, {
            kind: step.command.type,
            command: step.command,
            checkpoint: encodeSave(expected),
          });
          await page.getByRole("button", { name: "Open menu", exact: true }).click();
          await page.getByRole("button", { name: "Main menu", exact: true }).click();
        } else if (step.kind === "collection") {
          await page.getByRole("button", { name: "Collection", exact: true }).click();
          await page.getByRole("button", { name: "Inspect Mossguard", exact: true }).click();
          await page.getByRole("button", { name: "Close inspection", exact: true }).click();
          await page.getByRole("button", { name: "Back", exact: true }).click();
        } else if (step.kind === "settings") {
          await page.getByRole("button", { name: "Settings", exact: true }).click();
          await page.getByRole("radio", { name: "Tooltip 125%", exact: true }).click();
          await page.getByRole("button", { name: "Back", exact: true }).click();
        } else {
          await page.getByRole("button", { name: "Talents", exact: true }).click();
          await page.getByRole("button", { name: "Burn talents", exact: true }).click();
          await page.getByRole("button", { name: "Back", exact: true }).click();
          await page.getByRole("button", { name: "Back", exact: true }).click();
        }
        await page.locator(".app:not([inert])[data-save-status=saved]").waitFor();
        const saved = await page.evaluate(() => localStorage.getItem("fauna.save.v1"));
        if (encodeSave(decodeSave(saved)) !== encodeSave(expected))
          throw new Error("Committed checkpoint differs from command result");
        const checkpointHash = hash(encodeSave(expected));
        if (!generate && step.checkpointHash && step.checkpointHash !== checkpointHash)
          throw new Error("Recorded checkpoint diverged");
        if (generate) step.checkpointHash = checkpointHash;
        else if (captureCheckpoints && !step.checkpointHash) {
          step.checkpointHash = checkpointHash;
          trace[index] = step;
        }
        state = expected;
      }
      return { valid: true, failure: null };
    } catch (error) {
      // Stable action kind plus first error line distinguishes unrelated failures.
      return {
        valid: true,
        failure: `${(generate ? report.actions : trace)[index]?.kind}: ${error.message.split("\n")[0]}`,
        index,
      };
    } finally {
      await context.close();
    }
  }
  try {
    const result = await replay(prior?.actions, !prior, !!prior);
    if (prior) report.actions = prior.actions;
    report.failure = result.failure ?? (!result.valid ? "Inapplicable replay command" : null);
    report.complete = result.valid && !result.failure;
    if (report.failure && options.shrink === "true") {
      const candidates = report.actions.map(({ checkpointHash: _hash, ...step }) => step);
      report.shrunk = await shrinkTrace(candidates, report.failure, (trace) => replay(trace));
      await writeFile(
        path.join(out, "minimal.json"),
        JSON.stringify(
          { ...report, actions: report.shrunk.actions, checkpointMode: "recompute", shrunk: null },
          null,
          2,
        ),
      );
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
    await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  }
  console.log(
    `${report.complete ? "Complete" : "Failed"} interaction trace: ${path.join(out, "report.json")}`,
  );
  if (!report.complete) process.exitCode = 1;
} finally {
  await loader.close();
}
