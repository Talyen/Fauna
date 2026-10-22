import { chromium, _electron as electron } from "@playwright/test";
import { preview } from "vite";
import { readFile, writeFile, readdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { ROOT, runtime, identity, hash, reportDirectory } from "../lib/tool-runtime.mjs";
import { comparePerformance, summarizeSample } from "./metrics.mjs";
import { isolatedDesktopEnvironment } from "../lib/desktop-environment.mjs";
const read = async (file) => JSON.parse(await readFile(path.resolve(file), "utf8"));
export async function performanceBuildIdentity(repository = ROOT) {
  const files = [];
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else files.push(`${path.relative(repository, file)}:${hash(await readFile(file))}`);
    }
  }
  if (!(await readFile(path.join(repository, "dist/index.html"))).length)
    throw new Error("Build the production renderer before capturing performance.");
  await walk(path.join(repository, "dist"));
  await walk(path.join(repository, "desktop"));
  for (const name of ["package.json", "src/game/save-format.json"])
    files.push(`${name}:${hash(await readFile(path.join(repository, name)))}`);
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
export async function action(page, step) {
  if (step.kind === "click") await page.getByRole("button", { name: step.name, exact: true }).click();
  else if (step.kind === "play") {
    await page
      .locator(`.app:not([inert]) .hand [data-card-id=${JSON.stringify(step.command.cardId)}]`)
      .click();
    if (step.command.targetId)
      await page
        .locator(`.app:not([inert]) [data-actor-id=${JSON.stringify(step.command.targetId)}] .creature-card`)
        .click();
    else await page.locator(".app:not([inert]) .confirm-play").click();
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
  await page.waitForFunction(async (checkpoint) => {
    const saved = window.faunaDesktop
      ? (await window.faunaDesktop.readCandidates()).find((row) => row.source === "primary")?.data
      : localStorage.getItem("fauna.save.v1");
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
async function capture(browser, url, scenario, measured, native = false, cold = false) {
  let context, app, profile;
  const launched = performance.now();
  try {
    let page;
    const initialize = (initial) => {
      if (!window.faunaDesktop) localStorage.setItem("fauna.save.v1", initial);
      localStorage.setItem("fauna.auto-end-turn", "false");
    };
    if (native) {
      profile = await mkdtemp(path.join(os.tmpdir(), "fauna-perf-"));
      await writeFile(path.join(profile, "expedition.json"), scenario.initial);
      const env = isolatedDesktopEnvironment(profile);
      env.FAUNA_PERF_CAPTURE = "1";
      app = await electron.launch({
        ...(process.env.FAUNA_ELECTRON_EXECUTABLE
          ? { executablePath: process.env.FAUNA_ELECTRON_EXECUTABLE }
          : {}),
        args: [ROOT, "--mute-audio"],
        env,
        timeout: 20000,
      });
      page = await app.firstWindow();
      await app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.setContentSize(1280, 800);
        window.webContents.setAudioMuted(true);
      });
      if (!cold) {
        await page.evaluate(initialize, scenario.initial);
        await page.reload();
      }
    } else {
      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        reducedMotion: "no-preference",
      });
      await context.addInitScript(initialize, scenario.initial);
      page = await context.newPage();
      await page.goto(url);
    }
    page.setDefaultTimeout(15000);
    await page.getByRole("button", { name: "Continue", exact: true }).waitFor();
    const startupMs = performance.now() - launched;
    if (scenario.id !== "menus" && scenario.id !== "startup")
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.locator(".app:not([inert])[data-save-status=saved]").waitFor();
    await page.locator("img").evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
    const environment = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    }));
    if (measured) await startSampler(page);
    for (const [i, step] of scenario.actions.entries()) {
      if (measured) await page.evaluate((name) => window.faunaPerf.segment(name), `${i}-${step.kind}`);
      if (step.kind !== "idle") await action(page, step);
      await page.waitForTimeout(1200);
      if (measured) await page.evaluate(() => window.faunaPerf.end());
    }
    if (measured)
      return {
        ...(await page.evaluate(() => window.faunaPerf.stop())),
        startupMs: cold ? startupMs : null,
        nativeVersion: app ? await app.evaluate(() => process.versions.electron) : null,
        environment,
      };
  } finally {
    await context?.close();
    await app?.close();
    if (profile) await rm(profile, { recursive: true, force: true });
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
  let prior,
    scenarioId,
    output,
    native = false,
    cold = false,
    suite = "fixed",
    seed = 42;
  if (replayMode) {
    prior = await read(args[1]);
    output = args[2];
    native = prior.environment.runtime === "electron";
    cold = prior.environment.cold;
    suite = prior.environment.suite;
    seed = prior.environment.seed;
    if (!prior.complete || prior.format !== 2) throw new Error("Cannot replay incomplete report.");
  } else {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--electron") native = true;
      else if (args[i] === "--cold") cold = true;
      else if (["--scenario", "--out", "--suite", "--seed"].includes(args[i])) {
        const flag = args[i],
          value = args[++i];
        if (!value) throw new Error("Missing option value.");
        if (flag === "--scenario") scenarioId = value;
        if (flag === "--out") output = value;
        if (flag === "--suite") suite = value;
        if (flag === "--seed") seed = Number(value);
      } else
        throw new Error(
          "Usage: perf -- [--electron] [--cold] [--suite fixed|reachable] [--seed N] [--scenario ID] [--out reports/path]",
        );
    }
  }
  if (!["fixed", "reachable"].includes(suite) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Invalid performance suite or seed.");
  if (cold && (!native || suite !== "fixed" || (scenarioId && scenarioId !== "startup")))
    throw new Error("Cold capture requires --electron and the fixed startup scenario.");
  if (cold) scenarioId = "startup";
  const out = await reportDirectory(output, `reports/performance/capture-${Date.now()}`);
  const report = {
    format: 2,
    complete: false,
    identity: await identity(),
    buildIdentity: await performanceBuildIdentity(),
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
      const { performanceCases, reachablePerformanceCases } = await loader.ssrLoadModule(
        "/src/tooling/performance.ts",
      );
      scenarios = prior
        ? prior.cases.map((row) => row.scenario)
        : cold
          ? [
              {
                id: "startup",
                fixture: "cold-process-fresh-profile-v1",
                initial: performanceCases(seed)[0].initial,
                actions: [{ kind: "idle" }],
              },
            ]
          : (suite === "reachable" ? await reachablePerformanceCases(seed) : performanceCases(seed)).filter(
              (row) => !scenarioId || row.id === scenarioId,
            );
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
    if (!native) browser = await chromium.launch({ args: ["--mute-audio"] });
    report.environment = {
      runtime: native ? "electron" : "chromium",
      browser: native
        ? (await import("electron/package.json", { with: { type: "json" } })).default.version
        : browser.version(),
      cold,
      windowFrame: !native,
      suite,
      seed,
      platform: process.platform,
      architecture: process.arch,
      cpu: os.cpus()[0]?.model ?? null,
      viewport: { width: 1280, height: 800 },
      dpr: 1,
      reducedMotion: false,
      warmup: 1,
      runs: 1,
      autoEndTurn: cold,
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
        await capture(browser, url, scenario, false, native, cold);
        record.sample = await capture(browser, url, scenario, true, native, cold);
        if (
          JSON.stringify(record.sample.environment.viewport) !==
            JSON.stringify(report.environment.viewport) ||
          record.sample.environment.reducedMotion !== false
        )
          throw new Error("Actual viewport/motion differs from capture settings.");
        if (report.cases.length && record.sample.environment.dpr !== report.environment.dpr)
          throw new Error("DPR changed during capture.");
        report.environment.dpr = record.sample.environment.dpr;
        if (record.sample.nativeVersion) report.environment.browser = record.sample.nativeVersion;
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
