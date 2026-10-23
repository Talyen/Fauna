import { clamp } from "./math";
import { shouldReduceMotion } from "./animation-prefs";

export interface CanvasBackingScaleOptions {
  scaleMultiplier?: number;
  minScale?: number;
  maxScale?: number;
  maxPixels?: number;
}

export function resolveCanvasBackingScale(
  width: number,
  height: number,
  options: CanvasBackingScaleOptions = {},
): number {
  const { scaleMultiplier = 1, minScale = 0.25, maxScale = 2.0, maxPixels = 3_000_000 } = options;
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const dpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
  const requested = (dpr || 1) * scaleMultiplier;
  const pixelLimited = Math.sqrt(maxPixels / (safeWidth * safeHeight));
  return Math.min(clamp(requested, minScale, maxScale), pixelLimited);
}

export interface CanvasLifecycleOptions {
  canvas: HTMLCanvasElement;
  active?: () => boolean;
  backingScale?: CanvasBackingScaleOptions;
  fpsLimit?: number;
  pauseOnBlur?: boolean;
  immediate?: boolean;
  onResize?: (width: number, height: number, backingScale: number) => void;
  onFrame: (now: number, dt: number, width: number, height: number) => void;
}

export interface CanvasLifecycle {
  logicalWidth: number;
  logicalHeight: number;
  scheduleFrame: () => void;
  dispose: () => void;
}

export function createCanvasLifecycle({
  canvas,
  active = () => true,
  backingScale: backingScaleOptions,
  fpsLimit,
  pauseOnBlur = true,
  immediate = false,
  onResize,
  onFrame,
}: CanvasLifecycleOptions): CanvasLifecycle {
  const parent = canvas.parentElement;
  if (!parent) {
    return { logicalWidth: 0, logicalHeight: 0, scheduleFrame: () => {}, dispose: () => {} };
  }

  const activeParent = parent;
  const lifetime = new AbortController();
  const document = globalThis.document;
  const window = globalThis.window;
  let animFrameId: number | null = null;
  let frameVersion = 0;
  let lastTime = performance.now();
  let nextFrameAt: number | null = null;
  const minFrameIntervalMs = fpsLimit && fpsLimit > 0 ? 1000 / fpsLimit : 0;
  // Small callback jitter must not push a due draw to the following vsync.
  const frameDeadlineToleranceMs = Math.min(3, minFrameIntervalMs / 10);

  const lifecycle: CanvasLifecycle = {
    logicalWidth: 0,
    logicalHeight: 0,
    scheduleFrame,
    dispose,
  };

  let ro: ResizeObserver | null = null;
  let motionQuery: MediaQueryList | undefined;
  let lastDpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
  let lastBackingScale: number | undefined;

  function resize() {
    if (lifetime.signal.aborted) return;
    lastDpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
    const w = activeParent.clientWidth;
    const h = activeParent.clientHeight;
    const cssWidth = `${w}px`;
    const cssHeight = `${h}px`;
    if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
    if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;

    const visible = w > 0 && h > 0;
    const scale = visible ? resolveCanvasBackingScale(w, h, backingScaleOptions) : 1;
    const backingWidth = visible ? Math.max(1, Math.floor(w * scale)) : 1;
    const backingHeight = visible ? Math.max(1, Math.floor(h * scale)) : 1;
    const backingChanged = canvas.width !== backingWidth || canvas.height !== backingHeight;
    // Assigning either dimension clears the bitmap and drawing state, even
    // when the value is unchanged. The canvas itself owns its backing size.
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;

    const nextWidth = visible ? w : 0;
    const nextHeight = visible ? h : 0;
    const sizeChanged = lifecycle.logicalWidth !== nextWidth || lifecycle.logicalHeight !== nextHeight;
    const scaleChanged = lastBackingScale !== scale;
    lifecycle.logicalWidth = nextWidth;
    lifecycle.logicalHeight = nextHeight;
    // Focus/observer notifications and the observer-free frame loop can all
    // repeat the same size. Reinitialize drawing state only when its inputs change.
    if (sizeChanged || backingChanged || scaleChanged) {
      lastBackingScale = scale;
      try {
        onResize?.(nextWidth, nextHeight, scale);
      } catch (error) {
        dispose();
        throw error;
      }
      scheduleFrame();
    }
  }

  function isPaused() {
    return (
      lifetime.signal.aborted ||
      !active() ||
      shouldReduceMotion() ||
      document?.hidden ||
      (pauseOnBlur && document && !document.hasFocus()) ||
      (ro !== null && (lifecycle.logicalWidth === 0 || lifecycle.logicalHeight === 0))
    );
  }

  function scheduleFrame() {
    if (isPaused() || animFrameId !== null) return;
    const version = ++frameVersion;
    animFrameId = requestAnimationFrame((now) => {
      // Cancellation may race an already queued callback after focus resumes.
      if (version !== frameVersion || animFrameId === null) return;
      try {
        frame(now);
      } catch (error) {
        dispose();
        throw error;
      }
    });
  }

  function frame(now: number) {
    animFrameId = null;
    if (isPaused()) {
      lastTime = now;
      nextFrameAt = null;
      return;
    }

    const currentDpr = typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1;
    if (!ro || currentDpr !== lastDpr) {
      resize();
    }
    // Resize callbacks may dispose this lifetime or deactivate its owner.
    if (isPaused()) return;
    if (lifecycle.logicalWidth === 0 || lifecycle.logicalHeight === 0) {
      // Without an observer, keep checking layout until the mount becomes visible.
      lastTime = now;
      nextFrameAt = null;
      scheduleFrame();
      return;
    }

    if (minFrameIntervalMs > 0) {
      if (nextFrameAt !== null && now + frameDeadlineToleranceMs < nextFrameAt) {
        scheduleFrame();
        return;
      }
      // Retain the cadence across late callbacks instead of accumulating drift.
      // After a stall, skip missed deadlines rather than drawing catch-up frames.
      nextFrameAt =
        nextFrameAt === null
          ? now + minFrameIntervalMs
          : nextFrameAt +
            (Math.floor((now + frameDeadlineToleranceMs - nextFrameAt) / minFrameIntervalMs) + 1) *
              minFrameIntervalMs;
    }

    const dt = Math.min((now - lastTime) / 16.67, 3);
    lastTime = now;

    onFrame(now, dt, lifecycle.logicalWidth, lifecycle.logicalHeight);
    scheduleFrame();
  }

  function resume() {
    if (lifetime.signal.aborted || document?.hidden) return;
    resize();
    if (animFrameId !== null) return;
    lastTime = performance.now();
    nextFrameAt = null;
    scheduleFrame();
  }

  function cancelFrame() {
    if (animFrameId === null) return;
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  function dispose() {
    if (lifetime.signal.aborted) return;
    lifetime.abort();
    cancelFrame();
    ro?.disconnect();
    motionQuery?.removeEventListener("change", resume);
  }

  try {
    if (typeof ResizeObserver !== "undefined") ro = new ResizeObserver(resize);
    resize();
    ro?.observe(parent);

    motionQuery = window?.matchMedia?.("(prefers-reduced-motion: reduce)");
    motionQuery?.addEventListener("change", resume);

    const listenerOptions = { signal: lifetime.signal };
    document?.addEventListener("visibilitychange", resume, listenerOptions);
    window?.addEventListener("focus", resume, listenerOptions);
    window?.addEventListener("storage", resume, listenerOptions);
    if (pauseOnBlur) window?.addEventListener("blur", cancelFrame, listenerOptions);

    if (immediate && !isPaused()) {
      // resize() above may have already queued a frame; drop it before running
      // the synchronous first frame so dispose() tracks the only pending id.
      cancelFrame();
      frame(lastTime);
    } else {
      scheduleFrame();
    }
  } catch (error) {
    dispose();
    throw error;
  }

  return lifecycle;
}
