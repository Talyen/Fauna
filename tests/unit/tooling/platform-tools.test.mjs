import { temporaryDirectory } from "../../support/tooling.mjs";
import { it, expect } from "vitest";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import hardening from "../../../desktop/after-pack.cjs";
import { clampBounds, createDisplay } from "../../../desktop/display.cjs";
import { verifyFuses } from "../../../scripts/release/verify-package.mjs";
import { FuseState, getCurrentFuseWire } from "@electron/fuses";
it.each([8, 9, 7, 10])(
  "hardens supported fuse wires and rejects incomplete or unknown wires (%i slots)",
  async (length) => {
    const dir = temporaryDirectory("fauna-fuse-wire-");

    const executable = path.join(dir, "Fauna.exe");
    // Public Electron fuse wire format: sentinel, version, slot count, then ASCII states.
    await writeFile(
      executable,
      Buffer.concat([
        Buffer.from("dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX"),
        Buffer.from([1, length]),
        Buffer.alloc(length, FuseState.ENABLE),
      ]),
    );
    const context = {
      electronPlatformName: "win32",
      appOutDir: dir,
      packager: { appInfo: { productFilename: "Fauna" } },
    };
    if (length !== 9) {
      await expect(hardening(context)).rejects.toThrow(/fuse/i);
    } else {
      await hardening(context);
      const wire = await getCurrentFuseWire(executable);
      for (let index = 0; index < length; index++)
        expect(wire[index]).toBe(hardening.FUSES[index] ? FuseState.ENABLE : FuseState.DISABLE);
      expect(() => verifyFuses(wire)).not.toThrow();
      expect(() => verifyFuses({ ...wire, 0: FuseState.ENABLE })).toThrow();
    }
  },
);
it("copies the required browser snapshot and rejects incorrect fuse values", async () => {
  const dir = temporaryDirectory("fauna-snapshot-");

  await writeFile(path.join(dir, "v8_context_snapshot.bin"), "runtime");
  await hardening.installSnapshots(dir);
  expect(await readFile(path.join(dir, "browser_v8_context_snapshot.bin"), "utf8")).toBe("runtime");
  const wire = Object.fromEntries(
    Object.entries(hardening.FUSES).map(([k, v]) => [k, v ? FuseState.ENABLE : FuseState.DISABLE]),
  );
  expect(() => verifyFuses(wire)).not.toThrow();
  expect(() => verifyFuses({ ...wire, 0: FuseState.ENABLE })).toThrow();
  const { 8: _missing, ...incomplete } = wire;
  expect(() => verifyFuses(incomplete)).toThrow();
  expect(() => verifyFuses({ ...wire, 9: FuseState.ENABLE })).toThrow();
});
it("restores reachable bounds after monitor removal without resizing beyond the available display", () => {
  const bounds = clampBounds({ x: 5000, y: 9000, width: 2000, height: 2000 }, [
    { workArea: { x: 0, y: 0, width: 1280, height: 800 } },
  ]);
  expect(bounds).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
});
it("isolated Steam capability never loads or launches the native client", async () => {
  const { createSteam } = await import("../../../desktop/steam.cjs");
  const dir = temporaryDirectory("fauna-steam-isolated-");

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
});
it("serializes fullscreen requests and persists device preferences outside game saves", async () => {
  const { EventEmitter } = await import("node:events");
  const dir = temporaryDirectory("fauna-display-");
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
});

it("defaults Big Picture to fullscreen while preserving an explicit windowed preference", async () => {
  const dir = temporaryDirectory("fauna-tenfoot-");
  const screen = { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }] };

  const first = await createDisplay({ directory: dir, screen, bigPicture: true });
  expect(first.read().mode).toBe("fullscreen");
  await first.dispose();
  await writeFile(path.join(dir, "display.json"), JSON.stringify({ mode: "windowed", bounds: null }));
  const saved = await createDisplay({ directory: dir, screen, bigPicture: true });
  expect(saved.read().mode).toBe("windowed");
  await saved.dispose();
});
