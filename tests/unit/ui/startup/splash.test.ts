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
  localStorage.removeItem("fauna.language.v1");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it("localizes loading while keeping terminal startup silent when manual language wins over Steam", () => {
  localStorage.setItem("fauna.language.v1", "fr");
  const catalog = {
    "startup.loading": { source: "Loading Fauna", text: "Chargement de Fauna" },
    "startup.adventure": { source: "Adventure awaits…", text: "L’aventure vous attend…" },
  };
  splash = createStartupSplash({
    catalogs: { fr: catalog },
    qualified: ["en", "fr"],
    systemLanguages: ["en"],
  });
  expect(document.getElementById("startup-splash")?.getAttribute("aria-label")).toBe("Chargement de Fauna");
  expect(document.getElementById("startup-splash-phrase")?.textContent).toBe("L’aventure vous attend…");
  splash.setSteamLanguage("english");
  expect(document.getElementById("startup-splash-phrase")?.textContent).toBe("L’aventure vous attend…");
  splash.fail();
  expect(document.getElementById("startup-splash-phrase")?.textContent).toBe("");
});
it("updates an automatic splash when the Steam language arrives", () => {
  const catalog = { "startup.adventure": { source: "Adventure awaits…", text: "L’aventure vous attend…" } };
  splash = createStartupSplash({
    catalogs: { fr: catalog },
    qualified: ["en", "fr"],
    systemLanguages: ["en"],
  });
  expect(document.getElementById("startup-splash-phrase")?.textContent).toBe("Adventure awaits…");
  splash.setSteamLanguage("french");
  expect(document.getElementById("startup-splash-phrase")?.textContent).toBe("L’aventure vous attend…");
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
it.each([false, true])(
  "settles failure immediately and stops preparation with reduced motion %s",
  async (reduced) => {
    vi.mocked(matchMedia).mockReturnValue({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    vi.spyOn(performance, "now").mockReturnValue(0);
    splash = createStartupSplash();
    splash.fail();
    splash.fail();
    await splash.minimum;
    const element = document.getElementById("startup-splash")!;
    const phrase = document.getElementById("startup-splash-phrase")!;
    expect(element.classList.contains("startup-failed")).toBe(true);
    expect(element.getAttribute("aria-busy")).toBe("false");
    expect(element.getAttribute("aria-label")).toBe("Fauna");
    expect(phrase.getAttribute("aria-hidden")).toBe("true");
    expect(phrase.textContent).toBe("");
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20000);
    splash.dismiss();
    expect(element.isConnected).toBe(true);
    expect(phrase.textContent).toBe("");
    splash.dispose();
    splash.fail();
    expect(element.isConnected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  },
);
it.each([
  ["0.75", 0.8],
  ["1", 1],
  ["1.25", 1.2],
  ["invalid", 1],
  ["2", 1.2],
])("applies bounded Game Size before modules: %s", (raw, expected) => {
  const setProperty = vi.fn();
  const getItem = vi.fn(() => raw);
  runInNewContext(readFileSync("public/startup-preferences.js", "utf8"), {
    localStorage: { getItem },
    innerWidth: 1280,
    innerHeight: 720,
    document: { documentElement: { style: { setProperty } } },
  });
  expect(getItem).toHaveBeenCalledWith("fauna.game-scale");
  expect(setProperty).toHaveBeenCalledWith("--text-scale", String(expected));
  expect(setProperty).toHaveBeenCalledWith("--ui-density", String(expected));
});
it("fits first paint at wide viewports even when preference storage is blocked", () => {
  const setProperty = vi.fn();
  runInNewContext(readFileSync("public/startup-preferences.js", "utf8"), {
    localStorage: {
      getItem: () => {
        throw new Error("blocked");
      },
    },
    innerWidth: 1920,
    innerHeight: 1080,
    document: { documentElement: { style: { setProperty } } },
  });
  expect(setProperty).toHaveBeenCalledWith("--text-scale", "1.3599999999999999");
});
