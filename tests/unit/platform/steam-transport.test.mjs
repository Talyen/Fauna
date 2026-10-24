import { it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createGame } from "../../../src/game/engine";
import { encodeSave } from "../../../src/game/save";
import { createSteam } from "../../../desktop/steam.cjs";

async function transportFixture({ initializationFails = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-transport-lifetime-"));
  const env = process.env.FAUNA_STEAM_APP_ID;
  process.env.FAUNA_STEAM_APP_ID = "999999999";
  const worker = new EventEmitter();
  worker.kill = vi.fn();
  worker.postMessage = vi.fn(({ id, operation }) => {
    queueMicrotask(() => {
      worker.emit("message", {
        id,
        ...(operation === "init" && initializationFails ? { error: "native initialization failed" } : {}),
        value: operation === "init" ? "76561190000000000" : operation === "list" ? [] : true,
      });
    });
  });
  const disconnect = vi.fn();
  const pause = vi.fn();
  let overlay;
  try {
    const adapter = await createSteam({
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

it("drains every metadata write admitted before disposal and refuses later admission", async () => {
  const f = await transportFixture();
  try {
    const identity = await f.adapter.identity();
    const profile = path.join(f.directory, "profiles", identity.profile);
    const admitted = [
      f.adapter.writeLocal("earlier metadata"),
      f.adapter.writeLocal("latest metadata"),
      f.adapter.acknowledge("f".repeat(64)),
      f.adapter.preserve(["competing progress"]),
    ];
    const closing = f.adapter.dispose();
    await Promise.all([...admitted, closing]);
    expect(await readFile(path.join(profile, "cloud.json"), "utf8")).toBe("latest metadata");
    expect(await readFile(path.join(profile, "cloud-ack"), "utf8")).toBe("f".repeat(64));
    const recovery = await readdir(path.join(profile, "recovery"));
    expect(recovery).toHaveLength(1);
    expect(await readFile(path.join(profile, "recovery", recovery[0]), "utf8")).toBe("competing progress");
    await expect(f.adapter.writeLocal("late metadata")).rejects.toThrow("unavailable");
    await expect(f.adapter.readLocal()).rejects.toThrow("unavailable");
    expect(await readFile(path.join(profile, "cloud.json"), "utf8")).toBe("latest metadata");
  } finally {
    await f.adapter.dispose();
    await rm(f.directory, { recursive: true, force: true });
  }
});

it("retires the Cloud worker immediately when native initialization fails", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  let f;
  try {
    f = await transportFixture({ initializationFails: true });
    expect(f.worker.kill).toHaveBeenCalledOnce();
    expect((await f.adapter.identity()).available).toBe(false);
    // Overlay pause remains useful when Cloud is unavailable.
    f.overlay({ active: true });
    expect(f.pause).toHaveBeenCalledWith(true);
    await f.adapter.dispose();
    expect(f.worker.kill).toHaveBeenCalledOnce();
    expect(f.disconnect).toHaveBeenCalledOnce();
  } finally {
    await f?.adapter.dispose();
    if (f) await rm(f.directory, { recursive: true, force: true });
    warning.mockRestore();
  }
});

it("rejects all timed-out requests even when native worker termination throws", async () => {
  const f = await transportFixture();
  vi.useFakeTimers();
  try {
    f.worker.postMessage.mockImplementation(() => {});
    f.worker.kill.mockImplementationOnce(() => {
      throw new Error("native termination failed");
    });
    const pending = Promise.allSettled([f.adapter.list(), f.adapter.list()]);
    await vi.advanceTimersByTimeAsync(5000);
    const results = await pending;
    expect(results).toEqual([
      {
        status: "rejected",
        reason: expect.objectContaining({ message: expect.stringContaining("timed out") }),
      },
      {
        status: "rejected",
        reason: expect.objectContaining({ message: expect.stringContaining("timed out") }),
      },
    ]);
    expect(f.worker.kill).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    await expect(f.adapter.list()).rejects.toThrow("unavailable");
  } finally {
    await f.adapter.dispose();
    vi.useRealTimers();
    await rm(f.directory, { recursive: true, force: true });
  }
});

it("retires a failed native send without leaving a timeout that kills later transport", async () => {
  const f = await transportFixture();
  vi.useFakeTimers();
  try {
    f.worker.postMessage.mockImplementationOnce(() => {
      throw new Error("native send failed");
    });
    await expect(f.adapter.list()).rejects.toThrow("native send failed");
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.worker.kill).not.toHaveBeenCalled();
    expect(await f.adapter.list()).toEqual([]);
  } finally {
    await f.adapter.dispose();
    vi.useRealTimers();
    await rm(f.directory, { recursive: true, force: true });
  }
});

it.each(["disconnect", "kill"])(
  "completes shared Steam teardown when %s throws and ignores late overlay callbacks",
  async (failed) => {
    const f = await transportFixture();
    const nativeFs = createRequire(import.meta.url)("node:fs/promises");
    const rename = nativeFs.rename;
    let entered;
    const writing = new Promise((resolve) => (entered = resolve));
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const renaming = vi.spyOn(nativeFs, "rename").mockImplementation(async (from, to) => {
      if (String(to).endsWith("cloud.json")) {
        entered();
        await gate;
      }
      return rename(from, to);
    });
    let closing;
    try {
      const saving = f.adapter.writeLocal("admitted metadata");
      await writing;
      f.worker.postMessage.mockImplementationOnce(() => {});
      const rejected = expect(f.adapter.list()).rejects.toThrow("disposed");
      (failed === "disconnect" ? f.disconnect : f.worker.kill).mockImplementationOnce(() => {
        throw new Error("native cleanup failed");
      });
      let closed = false;
      closing = f.adapter.dispose();
      expect(f.adapter.dispose()).toBe(closing);
      void closing.then(() => (closed = true));
      await rejected;
      expect(f.worker.kill).toHaveBeenCalledOnce();
      expect(f.disconnect).toHaveBeenCalledOnce();
      expect(closed).toBe(false);
      f.overlay({ active: true });
      expect(f.pause).not.toHaveBeenCalled();
      release();
      await Promise.all([saving, closing]);
      expect(closed).toBe(true);
    } finally {
      release();
      await closing?.catch(() => {});
      renaming.mockRestore();
      await rm(f.directory, { recursive: true, force: true });
    }
  },
);

it("pins account storage, limits slot ownership and closes only its own worker", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-transport-"));
  const env = process.env.FAUNA_STEAM_APP_ID;
  process.env.FAUNA_STEAM_APP_ID = "999999999"; // Fake binding only; no external Steam call occurs.
  const files = new Map();
  let overlay;
  const disconnect = vi.fn(),
    kill = vi.fn();
  class Worker extends EventEmitter {
    postMessage({ id, operation, args }) {
      queueMicrotask(() => {
        let value;
        if (operation === "init") value = "76561190000000000";
        if (operation === "enabled") value = true;
        if (operation === "list") value = [...files.keys()];
        if (operation === "read") value = files.get(args[0]) ?? null;
        if (operation === "write") {
          files.set(args[0], args[1]);
          value = true;
        }
        this.emit("message", { id, value });
      });
    }
    kill() {
      kill();
      this.emit("exit");
    }
  }
  const pause = vi.fn();
  let adapter;
  try {
    adapter = await createSteam({
      app: { isPackaged: false },
      directory,
      isolated: false,
      pause,
      utilityProcess: { fork: () => new Worker() },
      loadBinding: () => ({
        createOverlay: (_appId, handler) => {
          overlay = (value) => handler(value.active);
          return { account: "76561190000000000", disconnect };
        },
      }),
    });
    const identity = await adapter.identity();
    expect(identity.available).toBe(true);
    overlay({ active: true });
    expect(adapter.overlay()).toBe(true);
    expect(pause).toHaveBeenCalledWith(true);
    const name = `fauna-v1-${identity.device}-1.json`;
    await adapter.write(name, "snapshot");
    expect(await adapter.read(name)).toBe("snapshot");
    await expect(adapter.write(`fauna-v1-${"d".repeat(32)}-0.json`, "foreign")).rejects.toThrow(
      "another device",
    );
    await expect(adapter.read("../other-game/save.json")).rejects.toThrow("Invalid cloud slot");
    await adapter.writeLocal("metadata");
    expect(await adapter.readLocal()).toBe("metadata");
    // A full remote inventory can conflict with one additional local checkpoint.
    const recovery = Array.from({ length: 65 }, (_, index) => `checkpoint-${index}`);
    await adapter.preserve(recovery);
    expect(await readdir(path.join(directory, "profiles", identity.profile, "recovery"))).toHaveLength(65);
    await expect(adapter.preserve([...recovery, "extra"])).rejects.toThrow("Invalid recovery set");
  } finally {
    await adapter?.dispose();
    if (env === undefined) delete process.env.FAUNA_STEAM_APP_ID;
    else process.env.FAUNA_STEAM_APP_ID = env;
    await rm(directory, { recursive: true, force: true });
  }
  expect(kill).toHaveBeenCalledOnce();
  expect(disconnect).toHaveBeenCalledOnce();
});

it("continues the last local Steam profile without a client, while isolated profiles ignore it", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-last-profile-"));
  const profile = "e".repeat(32);
  const data = encodeSave(createGame(9));
  let offline, isolated;
  try {
    await mkdir(path.join(directory, "profiles", profile), { recursive: true });
    await writeFile(path.join(directory, "last-profile"), profile);
    await writeFile(path.join(directory, "profiles", profile, "expedition.json"), data);
    const options = {
      app: { isPackaged: true },
      utilityProcess: {},
      directory,
      pause() {},
      loadBinding() {
        throw new Error("no client");
      },
    };
    offline = await createSteam({ ...options, isolated: false });
    expect((await offline.storage.readCandidates())[0].data).toBe(data);
    expect((await offline.identity()).available).toBe(false);
    isolated = await createSteam({ ...options, isolated: true });
    expect(await isolated.storage.readCandidates()).toEqual([]);
  } finally {
    await offline?.dispose();
    await isolated?.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
