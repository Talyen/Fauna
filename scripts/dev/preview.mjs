import { assets } from "../assets/assets.mjs";
import { createServer } from "vite";
import { randomUUID } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { reviewOptions } from "./review-options.mjs";
import { reviewScenario, openReviewScenario } from "./review-scenarios.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { previewDesktopEnvironment } from "../lib/desktop-environment.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function startPreview({ root = ROOT } = {}) {
  const token = randomUUID();
  const directory = path.join(root, "reports", "previews", token);
  await mkdir(directory, { recursive: true });
  let server;
  let stopped = false;
  const interrupted = () => void close();
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  async function close() {
    if (stopped) return;
    stopped = true;
    process.removeListener("SIGINT", interrupted);
    process.removeListener("SIGTERM", interrupted);
    const results = await Promise.allSettled([server?.close()]);
    for (const result of results)
      if (result.status === "rejected") console.error("Owned preview cleanup failed:", result.reason);
    await writeFile(path.join(directory, "closed.json"), JSON.stringify({ token })).catch((error) =>
      console.error("Could not record preview closure:", error),
    );
  }
  try {
    await assets({ repository: root });
    // Vite owns the listening socket, avoiding a free-port probe/start race.
    server = await createServer({
      root,
      server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: true,
        open: false,
        // Worktrees link dependencies outside their root, including bundled fonts.
        fs: { allow: [root, await realpath(path.join(root, "node_modules"))] },
      },
      plugins: [
        {
          name: "preview-identity",
          configureServer(vite) {
            vite.middlewares.use("/__fauna_preview", (_request, response) => response.end(token));
          },
        },
      ],
      define: { __FAUNA_QUIET_PREVIEW__: "true" },
    });
    if (stopped) {
      await server.close();
      throw new Error("Preview canceled.");
    }
    await server.listen();
    if (stopped) {
      await server.close();
      throw new Error("Preview canceled.");
    }
    const address = server.httpServer.address();
    const url = `http://127.0.0.1:${address.port}`;
    const identity = await fetch(`${url}/__fauna_preview`);
    if ((await identity.text()) !== token) throw new Error("Preview identity mismatch.");
    await writeFile(
      path.join(directory, "session.json"),
      JSON.stringify({ token, pid: process.pid, url, root }),
    );
    return { server, url, token, directory, close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function preview(args = process.argv.slice(2)) {
  const options = reviewOptions(args);
  let session, browser, desktop;
  let stopped = false;
  async function close() {
    stopped = true;
    desktop?.kill();
    await Promise.all([browser?.close(), session?.close()]);
  }
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
  try {
    session = await startPreview();
    if (stopped) throw new Error("Preview canceled.");
    if (options.mode === "browser") {
      const { chromium } = await import("@playwright/test");
      browser = await chromium.launch({ headless: false });
      if (stopped) throw new Error("Preview canceled.");
      const context = await browser.newContext({ viewport: options.viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      const scenario = options.scenario ? await reviewScenario(session.server, options.scenario) : null;
      if (scenario) await openReviewScenario(page, session.url, scenario, options.scale);
      else {
        await page.addInitScript(
          (scale) => localStorage.setItem("fauna.text-scale", String(scale)),
          options.scale,
        );
        await page.goto(session.url);
      }
      browser.on("disconnected", () => void session.close());
    } else if (options.mode === "desktop") {
      const { default: electron } = await import("electron");
      if (stopped) throw new Error("Preview canceled.");
      desktop = spawn(electron, [ROOT], {
        stdio: "inherit",
        env: previewDesktopEnvironment(path.join(session.directory, "profile"), session.url),
      });
      desktop.once("error", () => void close());
      desktop.once("exit", () => void close());
    }
    console.log(
      `Owned quiet preview ${session.token}: ${session.url}\nCtrl+C closes only this session. Records: ${session.directory}`,
    );
  } catch (error) {
    await close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await preview();
