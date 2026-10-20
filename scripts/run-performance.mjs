import { chromium } from "@playwright/test";
import { preview } from "vite";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { ROOT, runtime, identity, hash, reportDirectory } from "./lib/tool-runtime.mjs";
import { comparePerformance, summarizeSample } from "./lib/performance-metrics.mjs";
const read = async (file) => JSON.parse(await readFile(path.resolve(file), "utf8"));
async function buildIdentity() {
  const files = [];
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(?:js|css|html)$/.test(file))
        files.push(`${path.relative(ROOT, file)}:${hash(await readFile(file))}`);
    }
  }
  await walk(path.join(ROOT, "dist"));
  if (!files.length) throw new Error("Build the production renderer before capturing performance.");
  return hash(files.join("\n"));
}
async function startSampler(page) {
  await page.evaluate(async () => {
    const supported = PerformanceObserver.supportedEntryTypes ?? [];
    const snapshot = () => ({
      heap: performance.memory?.usedJSHeapSize ?? null,
      dom: document.querySelectorAll("*").length,
      media: document.querySelectorAll("audio,video").length,
    });
    const sample = {
      frames: [],
      longTasks: supported.includes("longtask") ? [] : null,
      input: supported.includes("event") ? [] : null,
      segments: [],
      before: snapshot(),
      after: null,
    };
    const observers = [];
    for (const type of ["longtask", "event"])
      if (supported.includes(type)) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            (type === "event" ? sample.input : sample.longTasks).push({
              start: entry.startTime,
              duration: entry.duration,
              inputDelay: type === "event" ? entry.processingStart - entry.startTime : null,
            });
        });
        observer.observe({ type, buffered: false, ...(type === "event" ? { durationThreshold: 16 } : {}) });
        observers.push({ observer, type });
      }
    let previous = null,
      handle;
    const frame = (now) => {
      if (previous !== null) sample.frames.push(now - previous);
      previous = now;
      handle = requestAnimationFrame(frame);
    };
    window.faunaPerf = {
      sample,
      segment: (name) => {
        window.faunaPerf.pending = { name, start: performance.now(), frame: sample.frames.length };
      },
      end: () => {
        const pending = window.faunaPerf.pending;
        sample.segments.push({
          name: pending.name,
          duration: performance.now() - pending.start,
          frames: sample.frames.length - pending.frame,
          complete: true,
        });
      },
      stop: () => {
        cancelAnimationFrame(handle);
        for (const { observer, type } of observers) {
          for (const entry of observer.takeRecords())
            (type === "event" ? sample.input : sample.longTasks).push({
              start: entry.startTime,
              duration: entry.duration,
              inputDelay: type === "event" ? entry.processingStart - entry.startTime : null,
            });
          observer.disconnect();
        }
        sample.after = snapshot();
        return sample;
      },
    };
    handle = requestAnimationFrame(frame);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function action(page, step) {
  if (step.kind === "click") await page.getByRole("button", { name: step.name, exact: true }).click();
  else if (step.kind === "play") {
    await page.locator(`[data-card-id=${JSON.stringify(step.command.cardId)}]`).click();
    if (step.command.targetId)
      await page.locator(`[data-actor-id=${JSON.stringify(step.command.targetId)}] .creature-card`).click();
    else await page.locator(".confirm-play").click();
  } else if (step.kind === "endTurn")
    await page.getByRole("button", { name: "End turn", exact: true }).click();
  else if (step.kind === "swap") {
    await page.getByRole("button", { name: "Swap", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Swap", exact: true })
      .locator(`[data-actor-id=${JSON.stringify(step.command.activeId)}] .creature-card`)
      .click();
    await page
      .getByRole("dialog", { name: "Swap", exact: true })
      .locator(`[data-actor-id=${JSON.stringify(step.command.reserve)}] .creature-card`)
      .click();
  } else throw new Error(`Unknown performance action: ${step.kind}`);
  await page.waitForFunction((checkpoint) => {
    const saved = localStorage.getItem("fauna.save.v1");
    const canonical = (value) =>
      JSON.stringify(value, (_key, entry) =>
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? Object.fromEntries(
              Object.keys(entry)
                .sort()
                .map((key) => [key, entry[key]]),
            )
          : entry,
      );
    return saved && canonical(JSON.parse(saved)) === canonical(JSON.parse(checkpoint));
  }, step.checkpoint);
}
async function capture(browser, url, scenario, measured) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "no-preference",
  });
  try {
    await context.addInitScript((initial) => {
      localStorage.setItem("fauna.save.v1", initial);
      localStorage.setItem("fauna.auto-end-turn", "false");
      localStorage.setItem("fauna.audio.v1", JSON.stringify({ enabled: false }));
    }, scenario.initial);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(url);
    await page.getByRole("button", { name: "Continue", exact: true }).waitFor();
    if (scenario.id !== "menus") await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.locator(".app[data-save-status=saved]").waitFor();
    await page.locator("img").evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    if (measured) await startSampler(page);
    for (const [i, step] of scenario.actions.entries()) {
      if (measured) await page.evaluate((name) => window.faunaPerf.segment(name), `${i}-${step.kind}`);
      await action(page, step);
      // Retain the action's ordinary feedback/transition window in its segment.
      await page.waitForTimeout(1200);
      if (measured) await page.evaluate(() => window.faunaPerf.end());
    }
    if (measured) return await page.evaluate(() => window.faunaPerf.stop());
  } finally {
    await context.close();
  }
}
export async function main(args = process.argv.slice(2)) {
  if (args[0] === "compare") {
    const before = await read(args[1]),
      after = await read(args[2]);
    const out = await reportDirectory(args[3], `reports/performance/comparison-${Date.now()}`);
    const result = comparePerformance(before, after);
    await writeFile(path.join(out, "comparison.json"), JSON.stringify(result, null, 2));
    console.log(`Performance comparison: ${out}`);
    return;
  }
  const replayMode = args[0] === "replay";
  let prior, scenarioId, output;
  if (replayMode) {
    prior = await read(args[1]);
    output = args[2];
    if (!prior.complete || prior.format !== 1) throw new Error("Cannot replay incomplete report.");
  } else
    for (let i = 0; i < args.length; i += 2) {
      if (args[i] === "--scenario") scenarioId = args[i + 1];
      else if (args[i] === "--out") output = args[i + 1];
      else throw new Error("Usage: perf -- [--scenario battle|swap|menus] [--out directory]");
      if (!args[i + 1]) throw new Error("Missing option value.");
    }
  const out = await reportDirectory(output, `reports/performance/capture-${Date.now()}`);
  const report = {
    format: 1,
    complete: false,
    identity: await identity(),
    buildIdentity: await buildIdentity(),
    replayOf: prior?.buildIdentity ?? null,
    environment: null,
    cases: [],
    failures: [],
  };
  const manifest = path.join(out, "report.json");
  await writeFile(manifest, JSON.stringify(report));
  let server, browser;
  try {
    let scenarios;
    const loader = await runtime();
    try {
      const { performanceCases } = await loader.ssrLoadModule("/src/application/performance.ts");
      scenarios = prior
        ? prior.cases.map((row) => row.scenario)
        : performanceCases().filter((row) => !scenarioId || row.id === scenarioId);
    } finally {
      await loader.close();
    }
    if (!scenarios.length) throw new Error("Unknown performance scenario.");
    server = await preview({
      root: ROOT,
      preview: { host: "127.0.0.1", port: 0, strictPort: true, open: false },
    });
    const address = server.httpServer.address();
    const url = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ args: ["--mute-audio"] });
    report.environment = {
      runtime: "chromium",
      browser: browser.version(),
      platform: process.platform,
      architecture: process.arch,
      cpu: os.cpus()[0]?.model ?? null,
      viewport: { width: 1280, height: 800 },
      dpr: 1,
      reducedMotion: false,
      warmup: 1,
      runs: 1,
      autoEndTurn: false,
      timingWindowMs: 1200,
    };
    for (const scenario of scenarios) {
      const record = {
        id: scenario.id,
        fixture: scenario.fixture,
        checkpointHash: hash(scenario.initial),
        actionHash: hash(JSON.stringify(scenario.actions)),
        scenario,
        sample: null,
      };
      try {
        await capture(browser, url, scenario, false);
        record.sample = await capture(browser, url, scenario, true);
        const summary = summarizeSample(record.sample);
        report.cases.push(record);
        await writeFile(path.join(out, `${scenario.id}-sample.json`), JSON.stringify(record.sample));
        await writeFile(path.join(out, `${scenario.id}-summary.json`), JSON.stringify(summary, null, 2));
      } catch (error) {
        report.failures.push({ id: scenario.id, reason: error.message });
        if (record.sample) report.cases.push(record);
      }
      await writeFile(manifest, JSON.stringify(report, null, 2));
    }
    report.complete = report.failures.length === 0 && report.cases.length === scenarios.length;
    if (prior && report.complete) comparePerformance(prior, report);
  } catch (error) {
    report.failures.push({ reason: error.message });
    report.complete = false;
  } finally {
    await browser?.close();
    if (server)
      await new Promise((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    await writeFile(manifest, JSON.stringify(report, null, 2));
  }
  console.log(`${report.complete ? "Complete" : "Incomplete"} performance capture: ${manifest}`);
  if (!report.complete) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
