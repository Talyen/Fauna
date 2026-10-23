import { afterEach, vi } from "vitest";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const stop of cleanups.splice(0).reverse()) stop();
  document.body.replaceChildren();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Real DOM sizing and a cancellable frame queue shared by renderer contract tests. */
export function animationHarness(width = 640, height = 480) {
  const parent = document.createElement("div");
  const canvas = document.createElement("canvas");
  parent.append(canvas);
  document.body.append(parent);
  const ctx = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
    fillStyle: "",
  };
  vi.spyOn(canvas, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("devicePixelRatio", 1);
  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  let latestFrame: FrameRequestCallback = () => {
    throw new Error("No frame scheduled");
  };
  const raf = vi.fn((callback: FrameRequestCallback) => {
    latestFrame = callback;
    pending.set(++nextId, callback);
    return nextId;
  });
  const cancel = vi.fn((id: number) => pending.delete(id));
  vi.stubGlobal("requestAnimationFrame", raf);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  let notifyResize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        notifyResize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  function resize(w: number, h: number) {
    Object.defineProperties(parent, {
      clientWidth: { value: w, configurable: true },
      clientHeight: { value: h, configurable: true },
    });
    notifyResize();
  }
  resize(width, height);
  return {
    canvas,
    ctx,
    raf,
    pending,
    disconnect,
    resize,
    notifyResize: () => notifyResize(),
    get latestFrame() {
      return latestFrame;
    },
    frame(now: number) {
      if (pending.size !== 1) throw new Error(`Expected one pending frame, got ${pending.size}`);
      const [id, callback] = pending.entries().next().value!;
      pending.delete(id);
      callback(now);
    },
    own<T extends () => void>(stop: T): T {
      cleanups.push(stop);
      return stop;
    },
  };
}
