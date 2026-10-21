import { it, expect } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import hardening from "../../desktop/after-pack.cjs";
import { clampBounds, createDisplay } from "../../desktop/display.cjs";
import { verifyFuses } from "../../scripts/verify-package.mjs";
import { FuseState } from "@electron/fuses";
it("copies the required browser snapshot and rejects incorrect fuse values", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "fauna-snapshot-"));
  try {
    await writeFile(path.join(dir, "v8_context_snapshot.bin"), "runtime");
    await hardening.installSnapshots(dir);
    expect(await readFile(path.join(dir, "browser_v8_context_snapshot.bin"), "utf8")).toBe("runtime");
    const wire = Object.fromEntries(
      Object.entries(hardening.FUSES).map(([k, v]) => [k, v ? FuseState.ENABLE : FuseState.DISABLE]),
    );
    expect(() => verifyFuses(wire)).not.toThrow();
    expect(() => verifyFuses({ ...wire, 0: FuseState.ENABLE })).toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("restores reachable bounds after monitor removal without resizing beyond the available display", () => {
  const bounds = clampBounds({ x: 5000, y: 9000, width: 2000, height: 2000 }, [
    { workArea: { x: 0, y: 0, width: 1280, height: 800 } },
  ]);
  expect(bounds).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
});
it("isolated Steam capability never loads or launches the native client", async () => {
  const { createSteam } = await import("../../desktop/steam.cjs");
  const dir = await mkdtemp(path.join(tmpdir(), "fauna-steam-isolated-"));
  try {
    const steam = await createSteam({
      app: { isPackaged: true },
      utilityProcess: {
        fork() {
          throw new Error("must not launch");
        },
      },
      directory: dir,
      isolated: true,
      pause() {},
    });
    expect((await steam.identity()).available).toBe(false);
    await expect(steam.list()).rejects.toThrow("unavailable");
    await steam.dispose();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("serializes fullscreen requests and persists device preferences outside game saves", async () => {
  const { EventEmitter } = await import("node:events");
  const dir = await mkdtemp(path.join(tmpdir(), "fauna-display-"));
  class Window extends EventEmitter {
    full = false;
    rectangle = { x: 0, y: 0, width: 1000, height: 750 };
    isDestroyed() {
      return false;
    }
    isFullScreen() {
      return this.full;
    }
    isSimpleFullScreen() {
      return this.full;
    }
    getBounds() {
      return this.rectangle;
    }
    setBounds(next) {
      this.rectangle = next;
    }
    setSimpleFullScreen(value) {
      this.full = value;
    }
    setFullScreen(value) {
      this.full = value;
      this.emit(value ? "enter-full-screen" : "leave-full-screen");
    }
  }
  try {
    const window = new Window();
    const manager = await createDisplay({
      directory: dir,
      screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1280, height: 800 } }] },
    });
    manager.attach(window);
    const first = manager.set("fullscreen"),
      second = manager.set("windowed");
    await Promise.all([first, second]);
    expect(manager.read()).toEqual({ mode: "windowed" });
    await expect(manager.set("invalid")).rejects.toThrow();
    await manager.dispose();
    expect(JSON.parse(await readFile(path.join(dir, "display.json"), "utf8")).mode).toBe("windowed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
