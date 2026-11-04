// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { installArtworkDensity } from "../../../src/ui/shared/artwork-density";
import { artworkWidth, assetUrl } from "../../../src/ui/shared/assets";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--artwork-pixel-ratio");
});

it("tracks fractional display and zoom changes, then releases every listener", () => {
  const queries: { change?: () => void; remove: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => {
      const query = { change: undefined as (() => void) | undefined, remove: vi.fn() };
      queries.push(query);
      return {
        addEventListener: (_: string, change: () => void) => {
          query.change = change;
        },
        removeEventListener: query.remove,
      };
    }),
  );
  const dispose = installArtworkDensity();
  const density = () => document.documentElement.style.getPropertyValue("--artwork-pixel-ratio");
  expect(density()).toBe("2");
  vi.stubGlobal("devicePixelRatio", 2.5);
  queries[0]!.change!();
  expect(density()).toBe("2.5");
  expect(window.matchMedia).toHaveBeenLastCalledWith("(resolution: 2.5dppx)");
  expect(queries[0]!.remove).toHaveBeenCalledWith("change", queries[0]!.change);
  vi.stubGlobal("devicePixelRatio", 3);
  window.dispatchEvent(new Event("resize"));
  expect(density()).toBe("3");
  dispose();
  expect(queries.at(-1)!.remove).toHaveBeenCalledWith("change", queries.at(-1)!.change);
  vi.stubGlobal("devicePixelRatio", 4);
  window.dispatchEvent(new Event("resize"));
  expect(density()).toBe("3");
});

it("retains measured raster limits while leaving vector artwork resolution independent", () => {
  expect(artworkWidth(assetUrl("logo.main-menu"), "creature")).toBe(1440);
  expect(artworkWidth(assetUrl("boon.bone-charm"), "action")).toBeGreaterThan(1000);
  expect(artworkWidth(assetUrl("location.ember-grove"), "creature")).toBeUndefined();
});
