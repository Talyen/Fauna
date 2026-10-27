import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { isolatedDesktopEnvironment } from "./desktop-environment.mjs";
import { leaseLatestDevelopment } from "../release/development-retention.mjs";
/** Renderer CDP works with disabled Node inspector fuses; no package is modified for testing. */
export async function launchPackaged(profile) {
  await rm(path.join(profile, "DevToolsActivePort"), { force: true });
  const root = path.resolve(import.meta.dirname, "../..");
  const lease = leaseLatestDevelopment(root);
  const child = spawn(
    path.join(lease?.directory ?? path.resolve(root, "release/win-unpacked"), "Fauna.exe"),
    ["--remote-debugging-port=0", `--user-data-dir=${profile}`, "--mute-audio"],
    { env: isolatedDesktopEnvironment(profile), stdio: "ignore" },
  );
  // An unsuccessful release keeps the lease rather than risking deletion.
  child.once("close", () => {
    try {
      lease?.release();
    } catch (error) {
      console.error(`Package lease retained: ${error.message}`);
    }
  });
  let browser, launchError;
  const connections = [];
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
    const connect = async () => {
      const connection = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      connections.push(connection);
      browser = connection;
    };
    await connect();
    const firstWindow = async () => {
      const context = browser.contexts()[0];
      return context.pages()[0] ?? context.waitForEvent("page", { timeout: 20000 });
    };
    return {
      firstWindow,
      reconnect: connect,
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
        await Promise.all(connections.map((connection) => connection.close().catch(() => {})));
      },
    };
  } catch (error) {
    child.kill();
    await Promise.all(connections.map((connection) => connection.close().catch(() => {})));
    throw error;
  }
}
