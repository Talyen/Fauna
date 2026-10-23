// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { animationHarness } from "../../support/animation-harness";
import { startBackgroundParticles } from "../../../src/ui/shared/effects/rendering/background-particles";

it("parks at zero size, preserves the draw count and alpha, and revokes stale frames", () => {
  const h = animationHarness(0, 0);
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const stop = h.own(startBackgroundParticles({ current: h.canvas }, ["#ff9646"], 0.5, 7));
  expect(h.pending.size).toBe(0);
  h.resize(200, 100);
  h.frame(16.67);
  expect(h.ctx.fillStyle).toBe("#ff9646");
  expect(h.ctx.globalAlpha).toBe(0.095);
  expect(h.ctx.arc).toHaveBeenCalledTimes(7);
  const stale = h.latestFrame;
  stop();
  stop();
  stale(33.34);
  expect(h.ctx.arc).toHaveBeenCalledTimes(7);
  expect(h.pending.size).toBe(0);
});

it("bounds a high-DPR 4K backdrop and preserves its logical coordinates", () => {
  const h = animationHarness(3840, 2160);
  vi.stubGlobal("devicePixelRatio", 2);
  h.own(startBackgroundParticles({ current: h.canvas }, ["#f5c45d"]));
  expect(h.canvas.width * h.canvas.height).toBeLessThanOrEqual(3_000_000);
  expect(h.ctx.setTransform).toHaveBeenLastCalledWith(
    h.canvas.width / 3840,
    0,
    0,
    h.canvas.height / 2160,
    0,
    0,
  );
});
