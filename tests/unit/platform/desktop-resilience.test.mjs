import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSteam } from "../../../desktop/steam.cjs";
import { createOverlay } from "../../../desktop/steam-overlay.cjs";
import { createDisplay } from "../../../desktop/display.cjs";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it.each([null, undefined, { id: 1.5 }, { id: 1, error: {} }])(
  "retires malformed worker replies without crashing or losing local metadata: %j",
  async (reply) => {
    const directory = await mkdtemp(path.join(tmpdir(), "fauna-worker-response-"));
    vi.stubEnv("FAUNA_STEAM_APP_ID", "999999999");
    const worker = new EventEmitter();
    worker.kill = vi.fn();
    worker.postMessage = vi.fn(({ id, operation }) => {
      queueMicrotask(() => {
        worker.emit("message", {
          id,
          value: operation === "init" ? "76561190000000000" : true,
        });
      });
    });
    let adapter;
    try {
      adapter = await createSteam({
        app: { isPackaged: false },
        directory,
        isolated: false,
        pause() {},
        utilityProcess: { fork: () => worker },
        loadBinding: () => ({
          createOverlay: () => ({ account: "76561190000000000", disconnect() {} }),
        }),
      });
      worker.postMessage.mockImplementation(() => {});
      const pending = Promise.allSettled([adapter.list(), adapter.list()]);
      expect(() => worker.emit("message", reply)).not.toThrow();
      const results = await pending;
      expect(results).toEqual(
        Array(2).fill({
          status: "rejected",
          reason: expect.objectContaining({ message: "Invalid Steam response envelope." }),
        }),
      );
      expect(worker.kill).toHaveBeenCalledOnce();
      expect(() => worker.emit("message", null)).not.toThrow();
      expect(worker.kill).toHaveBeenCalledOnce();
      await expect(adapter.list()).rejects.toThrow("unavailable");
      await adapter.writeLocal("locally durable metadata");
      expect(await adapter.readLocal()).toBe("locally durable metadata");
    } finally {
      await adapter?.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

function overlayApi() {
  let delivered = false;
  return {
    initialize: () => 0,
    account: () => "76561190000000000",
    manual() {},
    pipe: () => 1,
    run: vi.fn(),
    shutdown: vi.fn(),
    free: vi.fn(),
    active: () => true,
    next: (_pipe, message) => {
      if (delivered) return false;
      delivered = true;
      message.writeInt32LE(331, 4);
      message.writeInt32LE(1, 16);
      return true;
    },
  };
}

it("retires a failing overlay pump, releases its pause and bounds native cleanup", () => {
  vi.useFakeTimers();
  vi.stubEnv("SteamAppId", "previous");
  const api = overlayApi();
  const order = [];
  api.free.mockImplementation(() => {
    order.push("free");
    throw new Error("native callback release failed");
  });
  api.shutdown.mockImplementation(() => {
    order.push("shutdown");
    throw new Error("native shutdown failed");
  });
  const notify = vi.fn();
  const overlay = createOverlay(123456, notify, api);
  try {
    expect(() => vi.advanceTimersByTime(34)).not.toThrow();
    expect(notify.mock.calls).toEqual([[true], [false]]);
    expect(order).toEqual(["free", "shutdown"]);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(api.run).toHaveBeenCalledOnce();
  } finally {
    overlay.disconnect();
  }
  expect(api.shutdown).toHaveBeenCalledOnce();
});

it("frees overlay messages and continues pumping after a notification throws", () => {
  vi.useFakeTimers();
  vi.stubEnv("SteamAppId", "previous");
  const api = overlayApi();
  const overlay = createOverlay(
    123456,
    () => {
      throw new Error("renderer unavailable");
    },
    api,
  );
  try {
    expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    expect(api.free).toHaveBeenCalledOnce();
    expect(api.run.mock.calls.length).toBeGreaterThan(1);
    expect(api.shutdown).not.toHaveBeenCalled();
  } finally {
    overlay.disconnect();
  }
});

it("keeps display events and later preference writes usable when a notification throws", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-display-observer-"));
  const nativeFs = createRequire(import.meta.url)("node:fs/promises");
  const rename = nativeFs.rename;
  vi.spyOn(nativeFs, "rename")
    .mockRejectedValueOnce(new Error("temporary disk failure"))
    .mockImplementation(rename);
  let reported;
  const report = new Promise((resolve) => (reported = resolve));
  const screen = Object.assign(new EventEmitter(), {
    getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
  });
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    isFullScreen: () => false,
    getBounds: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
    setBounds() {},
  });
  const manager = await createDisplay({
    directory,
    screen,
    bigPicture: false,
    notify(state) {
      if (state.error) reported();
      throw new Error("renderer unavailable");
    },
  });
  try {
    manager.attach(window);
    await report;
    expect(() => window.emit("leave-full-screen")).not.toThrow();
    await expect(manager.dispose()).resolves.toBeUndefined();
    expect(JSON.parse(await readFile(path.join(directory, "display.json"), "utf8"))).toMatchObject({
      mode: "windowed",
      bounds: { width: 1440, height: 900 },
    });
  } finally {
    await manager.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
