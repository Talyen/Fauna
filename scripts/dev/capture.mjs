import { chromium } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startPreview } from "./preview.mjs";
import { reviewOptions } from "./review-options.mjs";
import { reviewScenario, openReviewScenario } from "./review-scenarios.mjs";
import { reportDirectory } from "../lib/tool-runtime.mjs";
import { git } from "../lib/git.mjs";
import { taskBase } from "../lib/task-selection.mjs";
import { verificationIdentity } from "../checks/verification-record.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

export async function capture(args = process.argv.slice(2)) {
  const options = reviewOptions(args, { capture: true });
  const output = await reportDirectory(null, `reports/review/${options.label}-${randomUUID()}`);
  const base = taskBase(ROOT);
  const environment = { ...process.env };
  const source = verificationIdentity(ROOT, base, [], environment);
  const evidence = {
    complete: false,
    runtime: "Vite browser preview",
    commit: git(ROOT, ["rev-parse", "HEAD"]).trim(),
    source,
    scenario: options.scenario,
    tier: options.tier,
    motion: "reduce",
    frames: [],
    interactions: "Not exercised by capture; inspect the images and exercise changed interactions separately",
  };
  let session, browser;
  let stopped = false;
  let failure;
  const close = async () => {
    await Promise.all([browser?.close(), session?.close()]);
  };
  const interrupted = () => {
    stopped = true;
    void close();
  };
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  try {
    session = await startPreview();
    if (stopped) throw new Error("Capture canceled.");
    const scenario = await reviewScenario(session.server, options.scenario);
    evidence.fixture = scenario.fixture;
    evidence.seed = scenario.seed;
    evidence.checkpointHash = createHash("sha256").update(scenario.save).digest("hex");
    await writeFile(path.join(output, "checkpoint.json"), scenario.save);
    const { settleScreen } = await session.server.ssrLoadModule("/tests/e2e/support/rendered-evidence.ts");
    const { layoutViolations } = await session.server.ssrLoadModule("/tests/e2e/support/layout-contract.ts");
    browser = await chromium.launch({ headless: true });
    if (stopped) throw new Error("Capture canceled.");
    for (const { width, height, scale } of options.conditions) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await openReviewScenario(page, session.url, scenario, scale);
        await page.mouse.move(0, 0);
        await settleScreen(page);
        await page
          .locator("img:visible")
          .evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
        const failures = await page.evaluate(layoutViolations);
        if (failures.length || errors.length) throw new Error(JSON.stringify({ layout: failures, errors }));
        const file = `${options.scenario}-${width}x${height}-${scale}.png`;
        await page.screenshot({ path: path.join(output, file) });
        evidence.frames.push({ file, width, height, scale, layoutFailures: failures, errors });
      } finally {
        await context.close();
      }
    }
    if (verificationIdentity(ROOT, base, [], environment) !== source)
      throw new Error("Source or dependencies changed during capture; repeat for comparable evidence.");
    evidence.complete = true;
  } catch (error) {
    evidence.failure = error.message;
    failure = error;
  } finally {
    try {
      await close();
    } catch (error) {
      failure ??= error;
      evidence.complete = false;
      evidence.cleanupFailure = error.message;
    }
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
    await writeFile(path.join(output, "evidence.json"), JSON.stringify(evidence, null, 2));
    console.log(`Focused capture evidence: ${output}`);
  }
  if (failure) throw failure;
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await capture();
