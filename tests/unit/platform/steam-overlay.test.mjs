import { afterEach, expect, it, vi } from "vitest";
import koffi from "koffi";
import { createOverlay, loadOverlayApi } from "../../../desktop/steam-overlay.cjs";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it.each(["configured", "pending", "configuration failure", "binding failure"])(
  "sets graphics up before readiness and preserves offline startup with %s Steam setup",
  (mode) => {
    const order = [];
    const app = Object.assign(new EventEmitter(), {
      isPackaged: true,
      setName() {},
      requestSingleInstanceLock: () => true,
      whenReady() {
        order.push("ready");
        return new Promise(() => {});
      },
    });
    const require = createRequire(import.meta.url);
    const context = vm.createContext({
      require: (name) => {
        if (name === "electron") return { app, protocol: { registerSchemesAsPrivileged() {} } };
        if (name === "./steam-config.json") {
          if (mode === "configuration failure") throw new Error("Unreadable optional configuration");
          return { appId: mode === "pending" ? null : 123456 };
        }
        if (name === "steamworks.js") {
          if (mode === "binding failure") throw new Error("Unavailable optional binding");
          return { electronEnableSteamOverlay: () => order.push("graphics") };
        }
        return name.startsWith("./") ? {} : require(name);
      },
      process: { env: {} },
      console: { warn: () => order.push("warning") },
      __dirname: "/fauna/desktop",
    });
    expect(() =>
      vm.runInContext(readFileSync(new URL("../../../desktop/main.cjs", import.meta.url), "utf8"), context),
    ).not.toThrow();
    expect(order).toEqual(
      mode === "configured" ? ["graphics", "ready"] : mode === "pending" ? ["ready"] : ["warning", "ready"],
    );
  },
);

it("loads the shipped SDK exports and decodes Steam's native activation payload without a client", () => {
  const api = loadOverlayApi();
  const payload = koffi.alloc("uint8_t", 1);
  const message = Buffer.alloc(24);
  try {
    koffi.encode(message, 8, "void *", payload);
    koffi.encode(payload, "uint8_t", 1);
    expect(api.active(message)).toBe(true);
    koffi.encode(payload, "uint8_t", 0);
    expect(api.active(message)).toBe(false);
  } finally {
    koffi.free(payload);
  }
});

it("dispatches activation and deactivation, frees every native message and stops on disposal", () => {
  vi.useFakeTimers();
  vi.stubEnv("SteamAppId", "previous");
  const events = [999, 331, 331];
  const active = [true, false];
  const api = {
    initialize: () => 0,
    account: () => "76561190000000000",
    manual: vi.fn(),
    pipe: () => 1,
    run: vi.fn(),
    free: vi.fn(),
    shutdown: vi.fn(),
    active: () => active.shift(),
    next: (_pipe, message) => {
      const event = events.shift();
      if (!event) return false;
      message.writeInt32LE(event, 4);
      message.writeInt32LE(1, 16);
      return true;
    },
  };
  const notify = vi.fn();
  const overlay = createOverlay(123456, notify, api);
  vi.advanceTimersByTime(34);
  expect(notify.mock.calls).toEqual([[true], [false]]);
  expect(api.free).toHaveBeenCalledTimes(3);
  overlay.disconnect();
  overlay.disconnect();
  vi.advanceTimersByTime(100);
  expect(api.run).toHaveBeenCalledTimes(1);
  expect(api.shutdown).toHaveBeenCalledOnce();
});

it("shuts down an initialized native client if callback setup fails", () => {
  const shutdown = vi.fn();
  expect(() =>
    createOverlay(123456, () => {}, {
      initialize: () => 0,
      account: () => "invalid",
      shutdown,
    }),
  ).toThrow("Invalid Steam account");
  expect(shutdown).toHaveBeenCalledOnce();
});

it("releases an in-flight native message before reentrant disposal shuts down Steam", () => {
  vi.useFakeTimers();
  vi.stubEnv("SteamAppId", "previous");
  const order = [];
  const api = {
    initialize: () => 0,
    account: () => "76561190000000000",
    manual() {},
    pipe: () => 1,
    run() {},
    active: () => true,
    free: () => order.push("free"),
    shutdown: () => order.push("shutdown"),
    next: (_pipe, message) => {
      message.writeInt32LE(331, 4);
      message.writeInt32LE(1, 16);
      return true;
    },
  };
  const overlay = createOverlay(123456, () => overlay.disconnect(), api);
  vi.advanceTimersByTime(34);
  expect(order).toEqual(["free", "shutdown"]);
  expect(vi.getTimerCount()).toBe(0);
});
