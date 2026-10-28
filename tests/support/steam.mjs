import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { onTestFinished, vi } from "vitest";
import { createSteam } from "../../desktop/steam.cjs";

/** Exercise the real adapter with an asynchronous, entirely local native worker. */
export async function transportFixture({ initializationFails = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-transport-"));
  let adapter;
  onTestFinished(async () => {
    try {
      await adapter?.dispose();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  const env = process.env.FAUNA_STEAM_APP_ID;
  process.env.FAUNA_STEAM_APP_ID = "999999999";
  const files = new Map();
  const worker = new EventEmitter();
  worker.kill = vi.fn();
  worker.postMessage = vi.fn(({ id, operation, args }) => {
    queueMicrotask(() => {
      let value = true;
      if (operation === "init") value = "76561190000000000";
      if (operation === "list") value = [...files.keys()];
      if (operation === "read") value = files.get(args[0]) ?? null;
      if (operation === "write") files.set(args[0], args[1]);
      worker.emit("message", {
        id,
        ...(operation === "init" && initializationFails ? { error: "native initialization failed" } : {}),
        value,
      });
    });
  });
  const disconnect = vi.fn();
  const pause = vi.fn();
  let overlay;
  try {
    adapter = await createSteam({
      app: { isPackaged: false },
      directory,
      isolated: false,
      pause,
      utilityProcess: { fork: () => worker },
      loadBinding: () => ({
        createOverlay: (_appId, handler) => {
          overlay = (value) => handler(value.active);
          return { account: "76561190000000000", disconnect };
        },
      }),
    });
    return { adapter, directory, worker, disconnect, pause, overlay };
  } finally {
    if (env === undefined) delete process.env.FAUNA_STEAM_APP_ID;
    else process.env.FAUNA_STEAM_APP_ID = env;
  }
}
