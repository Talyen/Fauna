export interface WebGLContextLifecycleOptions {
  canvas: HTMLCanvasElement;
  start: () => (() => void) | null;
  onAvailabilityChange?: ((available: boolean) => void) | undefined;
}

/** Owns renderer replacement and fallback, including failures in host callbacks. */
export function attachWebGLContextLifecycle({
  canvas,
  start,
  onAvailabilityChange,
}: WebGLContextLifecycleOptions): () => void {
  let stop: (() => void) | null = null;
  let disposed = false;
  let generation = 0;

  function releaseRenderer(renderer: (() => void) | null) {
    try {
      renderer?.();
    } catch {
      // Optional decoration must never interrupt play or independent cleanup.
    }
  }

  function release() {
    const previous = stop;
    stop = null;
    releaseRenderer(previous);
  }

  function notify(available: boolean) {
    try {
      onAvailabilityChange?.(available);
    } catch {
      // Optional decoration must never interrupt play or independent cleanup.
    }
  }

  function initialize() {
    if (disposed) return;
    const current = ++generation;
    release();
    // Cleanup can dispatch another context event or dispose the owner.
    if (disposed || current !== generation) return;
    let renderer: (() => void) | null = null;
    try {
      renderer = start();
    } catch {
      // Optional decoration must never interrupt play or independent cleanup.
    }
    if (disposed || current !== generation) {
      // Startup may synchronously lose its context. A late disposer still
      // belongs to the interrupted generation, never the replacement renderer.
      releaseRenderer(renderer);
      return;
    }
    stop = renderer;
    const available = renderer !== null;
    notify(available);
  }

  function handleLost(event: Event) {
    event.preventDefault();
    if (disposed) return;
    const current = ++generation;
    release();
    if (disposed || current !== generation) return;
    notify(false);
  }

  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", initialize);
  initialize();

  return () => {
    if (disposed) return;
    disposed = true;
    generation++;
    canvas.removeEventListener("webglcontextlost", handleLost);
    canvas.removeEventListener("webglcontextrestored", initialize);
    release();
  };
}
