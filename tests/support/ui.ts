import { beforeEach, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/** Opt-in browser substitutes for screen tests; sizing and animation tests own their mocks */
export function screenTestEnvironment({ visible = false } = {}) {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    // jsdom has no layout; this represents visibility for focus ownership only
    if (visible)
      vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}
