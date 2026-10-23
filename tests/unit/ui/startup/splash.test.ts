// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createStartupSplash } from "../../../../src/ui/startup/splash";

let splash: ReturnType<typeof createStartupSplash>;
beforeEach(() => {
  vi.useFakeTimers();
  const shell = new DOMParser().parseFromString(readFileSync("index.html", "utf8"), "text/html");
  document.body.replaceChildren(shell.getElementById("startup-splash")!);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  splash?.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it("counts the minimum from navigation and keeps the same splash and phrase clock through React startup", async () => {
  vi.spyOn(performance, "now").mockReturnValue(2000);
  splash = createStartupSplash();
  const element = document.getElementById("startup-splash");
  let ready = false;
  void splash.minimum.then(() => {
    ready = true;
  });
  await vi.advanceTimersByTimeAsync(1500);
  expect(document.getElementById("startup-splash-phrase")?.textContent).toBe("Waking creatures…");
  document.getElementById("root")?.append(document.createElement("main"));
  await vi.advanceTimersByTimeAsync(1499);
  expect(ready).toBe(false);
  expect(document.getElementById("startup-splash")).toBe(element);
  await vi.advanceTimersByTimeAsync(1);
  expect(ready).toBe(true);
  splash.dismiss();
  splash.dismiss();
  expect(element?.classList.contains("startup-dismissed")).toBe(true);
  await vi.advanceTimersByTimeAsync(400);
  expect(document.getElementById("startup-splash")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps reduced motion static and dismisses immediately without a transition event", async () => {
  vi.mocked(matchMedia).mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  vi.spyOn(performance, "now").mockReturnValue(0);
  splash = createStartupSplash();
  let ready = false;
  void splash.minimum.then(() => {
    ready = true;
  });
  await vi.advanceTimersByTimeAsync(4999);
  expect(ready).toBe(false);
  expect(document.getElementById("startup-splash-phrase")?.textContent).toBe("Adventure awaits…");
  await vi.advanceTimersByTimeAsync(1);
  expect(ready).toBe(true);
  splash.dismiss();
  expect(document.getElementById("startup-splash")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
it.each(["0.75", "1", "1.25", "invalid", "2"])(
  "applies only supported saved text sizes before modules: %s",
  (raw) => {
    const setProperty = vi.fn();
    runInNewContext(readFileSync("public/startup-preferences.js", "utf8"), {
      localStorage: { getItem: () => raw },
      document: { documentElement: { style: { setProperty } } },
    });
    if (["0.75", "1", "1.25"].includes(raw)) expect(setProperty).toHaveBeenCalledWith("--text-scale", raw);
    else expect(setProperty).not.toHaveBeenCalled();
  },
);
it("tolerates blocked preference storage", () => {
  expect(() =>
    runInNewContext(readFileSync("public/startup-preferences.js", "utf8"), {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    }),
  ).not.toThrow();
});
