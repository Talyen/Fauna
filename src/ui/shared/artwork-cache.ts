import { warmImage } from "./artwork-image";

type Priority = "visible" | "idle";
type Entry = {
  url: string;
  priority: Priority;
  state: "queued" | "loading" | "ready" | "failed";
  promise: Promise<void>;
  resolve: () => void;
  image?: HTMLImageElement;
  bytes: number;
  used: number;
  pins: number;
  attempts: number;
  interest: number;
  holdUntil: number;
};

/** One decode lane for the renderer; visible work takes precedence over speculation. */
export function createArtworkCache(report: (message: string) => void, budget = 96 * 1024 * 1024) {
  const entries = new Map<string, Entry>();
  let active: { entry: Entry; lifetime: AbortController } | undefined;
  let cancelScheduled: (() => void) | undefined;
  let disposed = false;
  let sequence = 0;
  let lastInput = -Infinity;
  let sweep: ReturnType<typeof setTimeout> | undefined;
  const inputEvents = ["pointerdown", "pointermove", "keydown", "wheel", "click"] as const;

  const trim = () => {
    const unused = [...entries.values()]
      .filter((entry) => entry.state === "ready" && !entry.pins)
      .sort((a, b) => a.used - b.used);
    let bytes = unused.reduce((sum, entry) => sum + entry.bytes, 0);
    for (const entry of unused) {
      if (bytes <= budget) break;
      if (entry.holdUntil > performance.now()) break;
      entries.delete(entry.url);
      bytes -= entry.bytes;
    }
    if (bytes > budget && sweep === undefined) {
      const delay = Math.min(
        ...unused
          .filter((entry) => entry.holdUntil > performance.now())
          .map((entry) => entry.holdUntil - performance.now()),
      );
      if (Number.isFinite(delay))
        sweep = setTimeout(
          () => {
            sweep = undefined;
            trim();
          },
          Math.max(1, delay),
        );
    }
  };
  const protect = (requested: readonly Entry[]) => {
    // A decoded destination must survive the gap between Suspense retry and layout-effect pins.
    for (const entry of requested) entry.holdUntil = performance.now() + 1000;
  };
  const next = () => {
    const queued = [...entries.values()].filter((entry) => entry.state === "queued");
    return queued.find((entry) => entry.priority === "visible") ?? queued[0];
  };
  const schedule = () => {
    cancelScheduled?.();
    cancelScheduled = undefined;
    if (disposed || active) return;
    const entry = next();
    if (!entry || (entry.priority === "idle" && document.hidden)) return;
    if (entry.priority === "visible") {
      const timer = setTimeout(pump, 0);
      cancelScheduled = () => clearTimeout(timer);
    } else if (performance.now() - lastInput < 200) {
      const timer = setTimeout(schedule, 200);
      cancelScheduled = () => clearTimeout(timer);
    } else if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback((deadline) => {
        if (deadline.timeRemaining() < 4) schedule();
        else void pump();
      });
      cancelScheduled = () => window.cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(pump, 100);
      cancelScheduled = () => clearTimeout(timer);
    }
  };
  async function pump() {
    cancelScheduled = undefined;
    if (disposed || active) return;
    const entry = next();
    if (!entry || (entry.priority === "idle" && document.hidden)) return;
    if (entry.priority === "idle" && performance.now() - lastInput < 200) {
      schedule();
      return;
    }
    const lifetime = new AbortController();
    active = { entry, lifetime };
    entry.state = "loading";
    entry.attempts++;
    const image = await warmImage(
      entry.url,
      lifetime.signal,
      report,
      entry.priority === "idle" ? "low" : "high",
    );
    active = undefined;
    if (disposed) return;
    if (entries.get(entry.url) !== entry) {
      schedule();
      return;
    }
    if (lifetime.signal.aborted) {
      entry.state = "queued";
      entry.attempts--;
    } else if (image) {
      entry.image = image;
      entry.bytes = image.naturalWidth * image.naturalHeight * 4;
      entry.used = ++sequence;
      entry.state = "ready";
      entry.resolve();
      if (entry.priority === "idle") trim();
    } else if (entry.attempts < 2) {
      entry.state = "queued";
    } else {
      entry.state = "failed";
      entry.resolve();
    }
    // Always yield a task between decodes, including cache hits and failures.
    schedule();
  }
  const request = (urls: readonly string[], priority: Priority) => {
    const requested = [...new Set(urls)].map((url) => {
      let entry = entries.get(url);
      if (!entry) {
        let resolve = () => {};
        const promise = new Promise<void>((done) => {
          resolve = done;
        });
        entry = {
          url,
          priority,
          state: "queued",
          promise,
          resolve,
          bytes: 0,
          used: ++sequence,
          pins: 0,
          attempts: 0,
          interest: 0,
          holdUntil: 0,
        };
        entries.set(url, entry);
      }
      if (priority === "visible") entry.priority = priority;
      entry.used = ++sequence;
      return entry;
    });
    if (priority === "visible" && active?.entry.priority === "idle") active.lifetime.abort();
    schedule();
    return requested;
  };
  const activity = () => {
    lastInput = performance.now();
    schedule();
  };
  const visibility = () => {
    if (document.hidden && active?.entry.priority === "idle") active.lifetime.abort();
    schedule();
  };
  for (const event of inputEvents) window.addEventListener(event, activity, { passive: true });
  document.addEventListener("visibilitychange", visibility);

  return {
    read(urls: readonly string[]) {
      if (urls.every((url) => entries.get(url)?.state === "ready")) {
        for (const url of urls) entries.get(url)!.used = ++sequence;
        return;
      }
      const requested = request(urls, "visible");
      const failed = requested.find((entry) => entry.state === "failed");
      if (failed) throw new Error(`Artwork unavailable: ${failed.url}`);
      const pending = requested.filter((entry) => entry.state !== "ready");
      if (pending.length)
        throw Promise.all(pending.map((entry) => entry.promise)).then(() => protect(requested));
    },
    async prepare(urls: readonly string[]) {
      const requested = request(urls, "visible");
      await Promise.all(requested.map((entry) => entry.promise));
      if (!disposed && requested.some((entry) => entry.state !== "ready"))
        throw new Error("Artwork preparation failed");
      protect(requested);
    },
    prefetch(urls: readonly string[]) {
      if (disposed) return () => {};
      const requested = request(urls, "idle");
      requested.forEach((entry) => {
        entry.interest++;
      });
      return () => {
        for (const entry of requested) {
          entry.interest--;
          if (entry.interest || entry.pins || entry.priority !== "idle" || entry.state === "ready") continue;
          if (entries.get(entry.url) !== entry) continue;
          entries.delete(entry.url);
          entry.resolve();
          if (active?.entry === entry) active.lifetime.abort();
        }
        schedule();
      };
    },
    retain(urls: readonly string[]) {
      const retained = [...new Set(urls)].flatMap((url) => {
        const entry = entries.get(url);
        return entry ? [entry] : [];
      });
      retained.forEach((entry) => {
        entry.pins++;
      });
      trim();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        retained.forEach((entry) => {
          entry.pins--;
        });
        trim();
      };
    },
    retryFailures() {
      for (const entry of entries.values()) if (entry.state === "failed") entries.delete(entry.url);
    },
    dispose() {
      disposed = true;
      clearTimeout(sweep);
      cancelScheduled?.();
      active?.lifetime.abort();
      for (const event of inputEvents) window.removeEventListener(event, activity);
      document.removeEventListener("visibilitychange", visibility);
      for (const entry of entries.values()) entry.resolve();
      entries.clear();
    },
  };
}

export type ArtworkCache = ReturnType<typeof createArtworkCache>;
