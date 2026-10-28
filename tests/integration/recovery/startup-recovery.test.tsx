// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mountGame } from "../../../src/main";
import { createStartupSplash } from "../../../src/ui/startup/splash";
import { createPlatform } from "../../../src/platform";
import { validateContent } from "../../../src/game/content-validation";
import { warmImages } from "../../../src/ui/startup/images";
import { screen } from "@testing-library/react";

const renderState = vi.hoisted(() => ({ broken: true }));
vi.mock("../../../src/ui/App", () => ({
  App: () => {
    if (renderState.broken) throw new Error("initial presentation failure");
    return <main>Recovered menu</main>;
  },
}));
vi.mock("../../../src/platform", () => ({ createPlatform: vi.fn() }));
vi.mock("../../../src/game/content-validation", () => ({ validateContent: vi.fn() }));
vi.mock("../../../src/ui/startup/images", () => ({
  warmImages: vi.fn().mockResolvedValue(undefined),
  waitForFonts: vi.fn().mockResolvedValue(undefined),
}));
let dispose: (() => Promise<void>) | undefined;
beforeEach(() => {
  dispose = undefined;
  renderState.broken = true;
  vi.mocked(validateContent).mockReset();
  vi.mocked(warmImages).mockClear();
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockReturnValue(0);
  const shell = new DOMParser().parseFromString(readFileSync("index.html", "utf8"), "text/html");
  document.body.replaceChildren(shell.getElementById("startup-splash")!, shell.getElementById("root")!);
});
afterEach(async () => {
  await act(async () => {
    await dispose?.();
  });
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("reveals the existing recovery owner after an initial render failure without replaying preparation", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const read = vi.fn().mockResolvedValue([]);
  vi.mocked(createPlatform).mockReturnValue({
    desktop: false,
    saves: { readCandidates: read, write: async () => {} },
  });
  await act(async () => {
    dispose = mountGame(createStartupSplash());
  });
  expect(screen.queryByRole("main")).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(read).toHaveBeenCalledOnce();
  expect(validateContent).toHaveBeenCalledOnce();
  await act(() => vi.advanceTimersByTimeAsync(400));
  expect(document.getElementById("startup-splash")).toBeNull();
  renderState.broken = false;
  await act(() => vi.advanceTimersByTimeAsync(600));
  expect(screen.getByRole("main").textContent).toBe("Recovered menu");
  expect(read).toHaveBeenCalledOnce();
  expect(validateContent).toHaveBeenCalledOnce();
});
it("handles invalid content once, settles the splash accessibly and leaves saved progress untouched", async () => {
  const read = vi.fn(async () => []);
  const write = vi.fn(async () => {});
  const diagnostics = vi.fn();
  const unhandled = vi.fn();
  window.addEventListener("unhandledrejection", unhandled);
  vi.mocked(createPlatform).mockReturnValue({
    desktop: false,
    diagnostics: { read: () => null, write: diagnostics },
    saves: { readCandidates: read, write },
  });
  vi.mocked(validateContent).mockImplementation(() => {
    throw new Error("private invalid catalog details");
  });
  try {
    await act(async () => {
      dispose = mountGame(createStartupSplash());
    });
    const status = screen.getByRole("status", { name: "Fauna could not start" });
    expect(status.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByText("Fauna could not start").getAttribute("aria-hidden")).toBeNull();
    expect(document.body.textContent).not.toContain("private invalid catalog details");
    await act(() => vi.advanceTimersByTimeAsync(20000));
    expect(validateContent).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(screen.queryByRole("main")).toBeNull();
    expect(diagnostics).toHaveBeenCalledOnce();
    expect(JSON.parse(diagnostics.mock.calls[0]![0])).toEqual([
      { source: "validation", message: "private invalid catalog details", count: 1 },
    ]);
    expect(vi.mocked(warmImages).mock.calls[0]![1].aborted).toBe(true);
    expect(unhandled).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    window.removeEventListener("unhandledrejection", unhandled);
  }
});
it.each(["dispose", "pagehide"])("suppresses a queued startup failure after %s", async (exit) => {
  const read = vi.fn(async () => []);
  vi.mocked(createPlatform).mockReturnValue({
    desktop: false,
    saves: { readCandidates: read, write: async () => {} },
  });
  vi.mocked(validateContent).mockImplementation(() => {
    throw new Error("invalid content");
  });
  const splash = createStartupSplash();
  const fail = vi.spyOn(splash, "fail");
  await act(async () => {
    dispose = mountGame(splash);
    if (exit === "dispose") await dispose();
    else window.dispatchEvent(new Event("pagehide"));
  });
  await act(() => vi.advanceTimersByTimeAsync(20000));
  expect(fail).not.toHaveBeenCalled();
  expect(document.getElementById("startup-splash")).toBeNull();
  expect(read).not.toHaveBeenCalled();
  expect(screen.queryByRole("main")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
it("does not reveal a disposed startup when a saved screen finishes loading later", async () => {
  let finishRead!: (value: []) => void;
  const read = new Promise<[]>((resolve) => {
    finishRead = resolve;
  });
  vi.mocked(createPlatform).mockReturnValue({
    desktop: false,
    saves: { readCandidates: () => read, write: async () => {} },
  });
  renderState.broken = false;
  const splash = createStartupSplash();
  const dismiss = vi.spyOn(splash, "dismiss");
  await act(async () => {
    dispose = mountGame(splash);
  });
  await act(async () => {
    await dispose!();
    finishRead([]);
  });
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(dismiss).not.toHaveBeenCalled();
  expect(screen.queryByRole("main")).toBeNull();
  expect(warmImages).toHaveBeenCalledOnce();
});
