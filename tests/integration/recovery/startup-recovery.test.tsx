// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mountGame } from "../../../src/main";
import { createStartupSplash } from "../../../src/ui/startup/splash";
import { createPlatform } from "../../../src/platform";
import { validateContent } from "../../../src/game/content-validation";
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
afterEach(async () => {
  await act(async () => {
    await dispose?.();
  });
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("reveals the existing recovery owner after an initial render failure without replaying preparation", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(performance, "now").mockReturnValue(0);
  const shell = new DOMParser().parseFromString(readFileSync("index.html", "utf8"), "text/html");
  document.body.replaceChildren(shell.getElementById("startup-splash")!, shell.getElementById("root")!);
  const read = vi.fn().mockResolvedValue([]);
  vi.mocked(createPlatform).mockReturnValue({
    desktop: false,
    steam: { available: false },
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
