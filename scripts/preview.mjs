import { assets } from "./assets.mjs";
import { createServer } from "vite";
import { randomUUID } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.some((arg) => !["--browser", "--desktop"].includes(arg)) || args.length > 1)
  throw new Error("Usage: npm run preview:task -- [--browser|--desktop]");
const token = randomUUID();
const directory = path.join(root, "reports", "previews", token);
await mkdir(directory, { recursive: true });
let server, browser, desktop;
let stopped = false;
async function close() {
  if (stopped) return;
  stopped = true;
  desktop?.kill();
  const results = await Promise.allSettled([browser?.close(), server?.close()]);
  for (const result of results)
    if (result.status === "rejected") console.error("Owned preview cleanup failed:", result.reason);
  await writeFile(path.join(directory, "closed.json"), JSON.stringify({ token })).catch((error) =>
    console.error("Could not record preview closure:", error),
  );
}
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
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
  if (args.includes("--browser")) {
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch({ headless: false });
    if (stopped) {
      await browser.close();
      throw new Error("Preview canceled.");
    }
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await page.goto(url);
    browser.on("disconnected", () => void close());
  } else if (args.includes("--desktop")) {
    const { default: electron } = await import("electron");
    if (stopped) throw new Error("Preview canceled.");
    desktop = spawn(electron, [root], {
      stdio: "inherit",
      env: { ...process.env, FAUNA_DEV_URL: url, FAUNA_PREVIEW_USER_DATA: path.join(directory, "profile") },
    });
    desktop.once("error", () => void close());
    desktop.once("exit", () => void close());
  }
  console.log(`Owned quiet preview ${token}: ${url}\nCtrl+C closes only this session. Records: ${directory}`);
} catch (error) {
  await close();
  throw error;
}
