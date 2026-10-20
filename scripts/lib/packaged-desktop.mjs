import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
/** Renderer CDP works with disabled Node inspector fuses; no package is modified for testing. */
export async function launchPackaged(profile) {
  await rm(path.join(profile, "DevToolsActivePort"), { force: true });
  const child = spawn(
    path.resolve("release/win-unpacked/Fauna.exe"),
    ["--remote-debugging-port=0", `--user-data-dir=${profile}`, "--mute-audio"],
    { env: { ...process.env, FAUNA_SMOKE_USER_DATA: profile, FAUNA_DISABLE_STEAM: "1" }, stdio: "ignore" },
  );
  let browser, launchError;
  child.once("error", (error) => {
    launchError = error;
  });
  try {
    let port;
    const until = Date.now() + 60000;
    while (Date.now() < until) {
      if (launchError) throw launchError;
      if (child.exitCode !== null) throw new Error(`Packaged game exited with ${child.exitCode}.`);
      try {
        port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
        if (port > 0 && port < 65536) break;
      } catch {
        /* Wait only for this owned process's endpoint. */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!port) throw new Error("Packaged renderer did not expose its test endpoint.");
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const firstWindow = async () => {
      const context = browser.contexts()[0];
      return context.pages()[0] ?? context.waitForEvent("page", { timeout: 20000 });
    };
    return {
      firstWindow,
      process: () => child,
      async close() {
        const page = await firstWindow();
        await page
          .evaluate(() => window.faunaDesktop.quit())
          .catch((error) => {
            if (!page.isClosed() && browser.isConnected()) throw error;
          });
        if (child.exitCode === null)
          await new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Packaged game did not finish its save/close handshake.")),
              10000,
            );
            child.once("exit", () => {
              clearTimeout(timer);
              resolve();
            });
          });
        await browser.close().catch(() => {});
      },
    };
  } catch (error) {
    child.kill();
    await browser?.close().catch(() => {});
    throw error;
  }
}
