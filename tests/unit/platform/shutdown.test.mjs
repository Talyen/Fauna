import { expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";

it.each(["throw", "reject"])("continues independent cleanup and quits after a native %s", async (failure) => {
  const app = new EventEmitter();
  Object.assign(app, {
    setName() {},
    requestSingleInstanceLock: () => true,
    whenReady: () => new Promise(() => {}),
    quit: vi.fn(),
  });
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const storage = { drain: vi.fn(() => pending) };
  const display = {
    dispose: vi.fn(() => {
      if (failure === "throw") throw new Error("display cleanup failed");
      return Promise.reject(new Error("display cleanup failed"));
    }),
  };
  const steam = { dispose: vi.fn(() => pending) };
  const require = createRequire(import.meta.url);
  const context = vm.createContext({
    require: (name) =>
      name === "electron"
        ? { app, protocol: { registerSchemesAsPrivileged() {} } }
        : name.startsWith("./")
          ? {}
          : require(name),
    process: { env: {} },
    __dirname: "/fauna/desktop",
    resources: { storage, display, steam },
    console: { error: vi.fn() },
  });
  const source = await readFile(new URL("../../../desktop/main.cjs", import.meta.url), "utf8");
  vm.runInContext(source, context);
  try {
    expect(() =>
      vm.runInContext(
        `
      storage = resources.storage;
      display = resources.display;
      steam = resources.steam;
      finishClose();
      finishClose();
    `,
        context,
      ),
    ).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(storage.drain).toHaveBeenCalledOnce();
    expect(display.dispose).toHaveBeenCalledOnce();
    expect(steam.dispose).toHaveBeenCalledOnce();
    expect(app.quit).not.toHaveBeenCalled();
  } finally {
    release();
  }
  await new Promise((resolve) => setImmediate(resolve));
  expect(app.quit).toHaveBeenCalledOnce();
});

it("drains native resources once when renderer close acknowledgement races renderer exit", async () => {
  const app = new EventEmitter();
  Object.assign(app, {
    setName() {},
    requestSingleInstanceLock: () => true,
    whenReady: () => new Promise(() => {}),
    quit: vi.fn(),
  });
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const storage = { drain: vi.fn(() => pending) };
  const display = { dispose: vi.fn(() => pending) };
  const steam = { dispose: vi.fn(() => pending) };
  const require = createRequire(import.meta.url);
  const context = vm.createContext({
    require: (name) =>
      name === "electron"
        ? { app, protocol: { registerSchemesAsPrivileged() {} } }
        : name.startsWith("./")
          ? {}
          : require(name),
    process: { env: {} },
    __dirname: "/fauna/desktop",
    resources: { storage, display, steam },
  });
  const source = await readFile(new URL("../../../desktop/main.cjs", import.meta.url), "utf8");
  vm.runInContext(source, context);
  // Both renderer terminal paths enter the same native close owner.
  vm.runInContext(
    `
    storage = resources.storage;
    display = resources.display;
    steam = resources.steam;
    finishClose();
    finishClose();
  `,
    context,
  );
  await Promise.resolve();
  expect(storage.drain).toHaveBeenCalledOnce();
  expect(display.dispose).toHaveBeenCalledOnce();
  expect(steam.dispose).toHaveBeenCalledOnce();
  expect(app.quit).not.toHaveBeenCalled();
  release();
  await new Promise((resolve) => setImmediate(resolve));
  expect(app.quit).toHaveBeenCalledOnce();
});
