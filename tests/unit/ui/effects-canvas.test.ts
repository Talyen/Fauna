// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import {
  createCanvasLifecycle,
  resolveCanvasBackingScale,
} from "../../../src/ui/shared/effects/rendering/canvas-lifecycle";
import { animationHarness } from "../../support/animation-harness";

it("caps backing scale by DPR and the rendered-pixel budget", () => {
  animationHarness();
  expect(resolveCanvasBackingScale(800, 600)).toBe(1);
  vi.stubGlobal("devicePixelRatio", 4);
  expect(resolveCanvasBackingScale(800, 600)).toBe(2);
  const scale = resolveCanvasBackingScale(3840, 2160, { maxPixels: 1_500_000 });
  expect(3840 * 2160 * scale * scale).toBeLessThanOrEqual(1_500_001);
});

it("rolls back frames and observers if setup throws before returning its disposer", () => {
  const h = animationHarness();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        throw new Error("observer failed");
      }
      disconnect = h.disconnect;
    },
  );
  const onFrame = vi.fn();
  expect(() => createCanvasLifecycle({ canvas: h.canvas, onFrame })).toThrow("observer failed");
  expect(h.disconnect).toHaveBeenCalledOnce();
  expect(h.pending.size).toBe(0);
  h.latestFrame(100);
  window.dispatchEvent(new Event("focus"));
  expect(onFrame).not.toHaveBeenCalled();
  expect(h.raf).toHaveBeenCalledOnce();
});

it("preserves the bitmap on unchanged sizes and repairs backing size, logical size, and DPR", () => {
  const h = animationHarness();
  vi.stubGlobal("ResizeObserver", undefined);
  h.canvas.width = 640;
  h.canvas.height = 480;
  const width = vi.spyOn(h.canvas, "width", "set");
  const height = vi.spyOn(h.canvas, "height", "set");
  const onResize = vi.fn(),
    onFrame = vi.fn();
  const lifecycle = createCanvasLifecycle({ canvas: h.canvas, onResize, onFrame });
  h.own(lifecycle.dispose);
  h.frame(100);
  h.frame(200);
  window.dispatchEvent(new Event("focus"));
  expect(onResize).toHaveBeenCalledExactlyOnceWith(640, 480, 1);
  expect(width).not.toHaveBeenCalled();
  expect(height).not.toHaveBeenCalled();
  expect(h.canvas.style.width).toBe("640px");
  h.resize(800, 480);
  h.frame(300);
  expect(onFrame).toHaveBeenLastCalledWith(300, expect.any(Number), 800, 480);
  expect(lifecycle.logicalWidth).toBe(800);
  vi.stubGlobal("devicePixelRatio", 2);
  h.frame(400);
  expect(onResize).toHaveBeenLastCalledWith(800, 480, 2);
  expect(h.canvas.height).toBe(960);
  h.canvas.width = 2;
  h.frame(500);
  expect(h.canvas.width).toBe(1600);
  expect(onResize).toHaveBeenCalledTimes(4);
});

it.each(["visibility", "OS-motion"])("parks and resumes frames after %s changes", (source) => {
  const h = animationHarness();
  const query = new EventTarget();
  let reduced = false;
  Object.defineProperty(query, "matches", { get: () => reduced });
  vi.stubGlobal("matchMedia", () => query);
  const onFrame = vi.fn();
  const lifecycle = createCanvasLifecycle({ canvas: h.canvas, onFrame });
  h.own(lifecycle.dispose);
  const pause = (value: boolean) => {
    if (source === "OS-motion") reduced = value;
    else vi.spyOn(document, "hidden", "get").mockReturnValue(value);
  };
  const notify = () => {
    if (source === "OS-motion") query.dispatchEvent(new Event("change"));
    else document.dispatchEvent(new Event("visibilitychange"));
  };
  pause(true);
  h.frame(100);
  expect(onFrame).not.toHaveBeenCalled();
  expect(h.pending.size).toBe(0);
  pause(false);
  notify();
  h.frame(200);
  expect(onFrame).toHaveBeenCalledExactlyOnceWith(200, expect.any(Number), 640, 480);
  lifecycle.dispose();
  notify();
  expect(h.pending.size).toBe(0);
});

it("revokes cancelled callbacks across focus changes and disposal without forking the frame loop", () => {
  const h = animationHarness();
  const onFrame = vi.fn(),
    onResize = vi.fn();
  const lifecycle = createCanvasLifecycle({ canvas: h.canvas, onFrame, onResize });
  h.own(lifecycle.dispose);
  const cancelled = h.latestFrame;
  window.dispatchEvent(new Event("blur"));
  window.dispatchEvent(new Event("focus"));
  cancelled(100);
  expect(onFrame).not.toHaveBeenCalled();
  expect(h.pending.size).toBe(1);
  h.frame(100);
  expect(onFrame).toHaveBeenCalledOnce();
  const late = h.latestFrame;
  lifecycle.dispose();
  lifecycle.dispose();
  onResize.mockClear();
  late(200);
  h.notifyResize();
  lifecycle.scheduleFrame();
  window.dispatchEvent(new Event("focus"));
  expect(h.pending.size).toBe(0);
  expect(onResize).not.toHaveBeenCalled();
  expect(h.disconnect).toHaveBeenCalledOnce();
});

it("parks drawing at zero size and resumes layout changes without ResizeObserver or a focus event", () => {
  const h = animationHarness(0, 0);
  vi.stubGlobal("ResizeObserver", undefined);
  const onFrame = vi.fn();
  const lifecycle = createCanvasLifecycle({ canvas: h.canvas, onFrame });
  h.own(lifecycle.dispose);
  h.frame(100);
  expect(onFrame).not.toHaveBeenCalled();
  h.resize(48, 64);
  h.frame(200);
  expect(h.canvas.width).toBe(48);
  expect(onFrame).toHaveBeenLastCalledWith(200, expect.any(Number), 48, 64);
  h.resize(0, 64);
  h.frame(300);
  expect(onFrame).toHaveBeenCalledOnce();
  h.resize(72, 64);
  h.frame(400);
  expect(onFrame).toHaveBeenLastCalledWith(400, expect.any(Number), 72, 64);
  expect(h.pending.size).toBe(1);
});

it("does not draw after a resize callback disposes the lifetime", () => {
  const h = animationHarness();
  vi.stubGlobal("ResizeObserver", undefined);
  const onFrame = vi.fn();
  const lifecycle = createCanvasLifecycle({
    canvas: h.canvas,
    onFrame,
    onResize: (width) => {
      if (width === 800) lifecycle.dispose();
    },
  });
  h.own(lifecycle.dispose);
  h.resize(800, 480);
  h.frame(100);
  expect(onFrame).not.toHaveBeenCalled();
  expect(h.pending.size).toBe(0);
});

it.each(["draw", "resize"])(
  "releases the lifetime after a %s failure so focus cannot restart the broken effect",
  (failure) => {
    const h = animationHarness();
    const onFrame = vi.fn(() => {
      if (failure === "draw") throw new Error("callback failed");
    });
    const lifecycle = createCanvasLifecycle({
      canvas: h.canvas,
      onFrame,
      onResize: (width) => {
        if (failure === "resize" && width === 800) throw new Error("callback failed");
      },
    });
    h.own(lifecycle.dispose);
    expect(() => (failure === "draw" ? h.frame(100) : h.resize(800, 480))).toThrow("callback failed");
    window.dispatchEvent(new Event("focus"));
    h.notifyResize();
    expect(onFrame).toHaveBeenCalledTimes(failure === "draw" ? 1 : 0);
    expect(h.disconnect).toHaveBeenCalledOnce();
    expect(h.pending.size).toBe(0);
  },
);

it.each([0, 2.2])("paces 30 FPS with %s ms callback jitter and skips missed deadlines", (jitter) => {
  const h = animationHarness();
  const draws: number[] = [];
  h.own(createCanvasLifecycle({ canvas: h.canvas, fpsLimit: 30, onFrame: (now) => draws.push(now) }).dispose);
  for (let index = 0; index <= 120; index++)
    h.frame(1000 + Math.round((index * 1000) / 6) / 10 + (index % 4 === 2 ? jitter : 0));
  expect(draws).toHaveLength(61);
  const gaps = draws.slice(1).map((now, index) => now - draws[index]!);
  expect(Math.min(...gaps)).toBeGreaterThan(31);
  expect(Math.max(...gaps)).toBeLessThan(35.7);
  for (const now of [4000, 4016.7, 4033.3]) h.frame(now);
  expect(draws.slice(-3)).toEqual([3000, 4000, 4033.3]);
});
