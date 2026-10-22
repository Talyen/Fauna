import { it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createGame } from "../../../src/game/engine";
import { encodeSave } from "../../../src/game/save";
import { createSteam } from "../../../desktop/steam.cjs";
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
        electronEnableSteamOverlay() {},
        SteamCallback: { GameOverlayActivated: 1 },
        init: () => ({
          callback: {
            register: (_id, handler) => {
              overlay = handler;
              return { disconnect };
            },
          },
          localplayer: { getSteamId: () => ({ steamId64: 76561190000000000n }) },
        }),
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
