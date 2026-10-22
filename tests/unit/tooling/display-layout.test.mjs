import { expect, it, vi } from "vitest";
import { clampBounds, minimumOuterSize, createDisplay } from "../../../desktop/display.cjs";

it("reserves a 1280 by 720 renderer viewport plus the actual native window frame", () => {
  const minimum = minimumOuterSize({
    getBounds: () => ({ width: 1300, height: 780 }),
    getContentBounds: () => ({ width: 1280, height: 720 }),
  });
  expect(minimum).toEqual({ width: 1300, height: 780 });
  expect(
    clampBounds(
      { x: 100, y: 100, width: 900, height: 700 },
      [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }],
      minimum,
    ),
  ).toEqual({ x: 100, y: 100, width: 1300, height: 780 });
});
it("keeps unsupported small work areas reachable instead of forcing an oversized window", () => {
  expect(
    clampBounds({ x: 5000, y: 9000, width: 1440, height: 1000 }, [
      { workArea: { x: 0, y: 0, width: 1024, height: 600 } },
    ]),
  ).toEqual({ x: 0, y: 0, width: 1024, height: 600 });
});

it("drains an admitted native display transition before disposal completes", async () => {
  const { EventEmitter } = await import("node:events");
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const directory = await mkdtemp(path.join(tmpdir(), "fauna-display-close-"));
  // Exercise the asynchronous Windows transition on every test host.
  const platform = vi.spyOn(process, "platform", "get").mockReturnValue("win32");
  const window = new EventEmitter();
  let full = false;
  Object.assign(window, {
    isDestroyed: () => false,
    isFullScreen: () => full,
    getBounds: () => ({ x: 0, y: 0, width: 1440, height: 900 }),
    setBounds: vi.fn(),
    setFullScreen: vi.fn(),
  });
  const manager = await createDisplay({
    directory,
    screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }] },
  });
  try {
    manager.attach(window);
    const changing = manager.set("fullscreen");
    await vi.waitFor(() => expect(window.setFullScreen).toHaveBeenCalledWith(true));
    let closed = false;
    const closing = manager.dispose().then(() => {
      closed = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(closed).toBe(false);
    full = true;
    window.emit("enter-full-screen");
    await Promise.all([changing, closing]);
    expect(JSON.parse(await readFile(path.join(directory, "display.json"), "utf8")).mode).toBe("fullscreen");
    await expect(manager.set("windowed")).rejects.toThrow("Invalid display request");
  } finally {
    full = true;
    window.emit("enter-full-screen");
    await manager.dispose();
    platform.mockRestore();
    await rm(directory, { recursive: true, force: true });
  }
});
