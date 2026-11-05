import { warmImage } from "./artwork-image";

type Priority = "visible" | "idle";
type Entry = {
  key: string;
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
  elements: ArtworkElement[];
  copyOf?: Entry;
  copy?: Entry;
};
export type ArtworkElement = { image: HTMLImageElement; entry: Entry; held: boolean };
export type ArtworkLease = { image: HTMLImageElement; release: () => void };

/** One decode lane for the renderer; visible work takes precedence over speculation. */
export function createArtworkCache(report: (message: string) => void, budget = 96 * 1024 * 1024) {
  const entries = new Map<string, Entry>();
  const claims = new Set<ArtworkElement>();
  let active: { entry: Entry; lifetime: AbortController } | undefined;
  let cancelScheduled: (() => void) | undefined;
  let disposed = false;
  let sequence = 0;
  let lastInput = -Infinity;
  let sweep: ReturnType<typeof setTimeout> | undefined;
  const inputEvents = ["pointerdown", "pointermove", "keydown", "wheel", "click"] as const;

  const trim = () => {
    const unused = [...entries.values()]
      .filter((entry) => !entry.copyOf && entry.state === "ready" && !entry.pins)
      .sort((a, b) => a.used - b.used);
    let bytes = unused.reduce((sum, entry) => sum + entry.bytes, 0);
    for (const entry of unused) {
      if (bytes <= budget) break;
      if (entry.holdUntil > performance.now()) break;
      entries.delete(entry.key);
      if (entry.copy) {
        entries.delete(entry.copy.key);
        entry.copy.resolve();
        if (active?.entry === entry.copy) active.lifetime.abort();
      }
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
    if (entries.get(entry.key) !== entry) {
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
      const owner = entry.copyOf ?? entry;
      owner.elements.push({ image, entry: owner, held: false });
      if (entry.copyOf) {
        entries.delete(entry.key);
        owner.copy = undefined;
        if (entry.priority === "visible") protect([owner]);
        spare(owner);
      }
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
          key: url,
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
          elements: [],
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
  const copy = (entry: Entry, priority: Priority) => {
    if (!entry.copy) {
      let resolve = () => {};
      const promise = new Promise<void>((done) => {
        resolve = done;
      });
      entry.copy = {
        key: `${entry.url}\0${++sequence}`,
        url: entry.url,
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
        elements: [],
        copyOf: entry,
      };
      entries.set(entry.copy.key, entry.copy);
    }
    if (priority === "visible") entry.copy.priority = priority;
    if (priority === "visible" && active?.entry.priority === "idle") active.lifetime.abort();
    schedule();
    return entry.copy;
  };
  const free = (entry: Entry) => entry.elements.filter((element) => !element.held && !claims.has(element));
  const capacity = (urls: readonly string[]) => {
    const needed = new Map<string, number>();
    for (const url of urls) needed.set(url, (needed.get(url) ?? 0) + 1);
    return [...needed].flatMap(([url, count]) => {
      const entry = entries.get(url);
      if (!entry || entry.state !== "ready" || entry.elements.length >= count) return [];
      const job = copy(entry, "visible");
      if (job.state === "failed") throw new Error(`Artwork element unavailable: ${url}`);
      return [job.promise];
    });
  };
  const spare = (entry: Entry) => {
    if (!disposed && (entry.pins || entry.interest) && free(entry).length < 2) copy(entry, "idle");
  };
  const hold = (element: ArtworkElement): ArtworkLease => {
    claims.delete(element);
    element.held = true;
    element.entry.pins++;
    spare(element.entry);
    let released = false;
    return {
      image: element.image,
      release() {
        if (released) return;
        released = true;
        element.image.remove();
        element.held = false;
        element.entry.pins--;
        trim();
      },
    };
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
    canAcquire(urls: readonly string[]) {
      const needed = new Map<string, number>();
      for (const url of urls) needed.set(url, (needed.get(url) ?? 0) + 1);
      return [...needed].every(([url, count]) => {
        const entry = entries.get(url);
        return entry?.state === "ready" && free(entry).length >= count;
      });
    },
    acquire(url: string) {
      const entry = entries.get(url);
      if (!entry || entry.state !== "ready") throw new Error(`Artwork must prepare before mounting: ${url}`);
      const element = free(entry)[0];
      if (element) {
        claims.add(element);
        return element;
      }
      const pending = copy(entry, "visible");
      claims.clear();
      if (pending.state === "failed") throw new Error(`Artwork element unavailable: ${url}`);
      throw pending.promise;
    },
    mount: hold,
    borrow(url: string) {
      const entry = entries.get(url);
      const element = entry && free(entry)[0];
      if (!entry || !element) {
        if (entry) spare(entry);
        return null;
      }
      return hold(element);
    },
    committed() {
      queueMicrotask(() => claims.clear());
    },
    read(urls: readonly string[]) {
      if (urls.every((url) => entries.get(url)?.state === "ready")) {
        for (const url of urls) entries.get(url)!.used = ++sequence;
        const pending = capacity(urls);
        if (pending.length) {
          claims.clear();
          throw Promise.all(pending);
        }
        return;
      }
      const requested = request(urls, "visible");
      const failed = requested.find((entry) => entry.state === "failed");
      if (failed) {
        claims.clear();
        throw new Error(`Artwork unavailable: ${failed.url}`);
      }
      const pending = requested.filter((entry) => entry.state !== "ready");
      if (pending.length) {
        claims.clear();
        throw Promise.all(pending.map((entry) => entry.promise)).then(() => protect(requested));
      }
    },
    readElements(urls: readonly string[]) {
      const needed = new Map<Entry, number>();
      for (const url of urls) {
        const entry = entries.get(url);
        if (!entry || entry.state !== "ready")
          throw new Error(`Artwork must prepare before reserving: ${url}`);
        needed.set(entry, (needed.get(entry) ?? 0) + 1);
      }
      const pending = [...needed].flatMap(([entry, count]) => {
        if (free(entry).length >= count) return [];
        const job = copy(entry, "visible");
        if (job.state === "failed") throw new Error(`Artwork element unavailable: ${entry.url}`);
        return [job.promise];
      });
      if (pending.length) {
        claims.clear();
        throw Promise.all(pending).then(() => protect([...needed.keys()]));
      }
    },
    async prepare(urls: readonly string[]) {
      const requested = request(urls, "visible");
      await Promise.all(requested.map((entry) => entry.promise));
      if (!disposed && requested.some((entry) => entry.state !== "ready"))
        throw new Error("Artwork preparation failed");
      // Repeated URLs reserve decoded elements, while sharing the source bitmap and decode lane.
      while (!disposed) {
        const pending = capacity(urls);
        if (!pending.length) break;
        await Promise.all(pending);
      }
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
      claims.clear();
      for (const entry of entries.values())
        if (entry.state === "failed") {
          entries.delete(entry.key);
          if (entry.copyOf) entry.copyOf.copy = undefined;
        }
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
      claims.clear();
    },
  };
}

export type ArtworkCache = ReturnType<typeof createArtworkCache>;
