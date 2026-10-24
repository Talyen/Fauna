/** Serialized into the measured renderer; owns only this capture's handles and bounded evidence. */
export async function installSampler({ recordSpans = true } = {}) {
  const supported = PerformanceObserver.supportedEntryTypes ?? [];
  const snapshot = () => ({
    heap: performance.memory?.usedJSHeapSize ?? null,
    dom: document.querySelectorAll("*").length,
    media: document.querySelectorAll("audio,video").length,
  });
  const sample = {
    recorderVersion: 1,
    timeOrigin: performance.timeOrigin,
    start: performance.now(),
    end: null,
    frames: [],
    spans: [],
    segments: [],
    longTasks: supported.includes("longtask") ? [] : null,
    input: supported.includes("event") ? [] : null,
    longAnimationFrames: supported.includes("long-animation-frame") ? [] : null,
    capabilities: supported,
    truncated: false,
    interrupted: false,
    before: snapshot(),
    after: null,
    visibility: document.visibilityState,
    focused: document.hasFocus(),
  };
  const limit = 12000;
  let stopped = false,
    pending,
    previous,
    handle,
    serial = 0;
  const open = new Map();
  const append = (list, entry) => {
    if (list.length >= limit) {
      sample.truncated = true;
      return;
    }
    list.push(entry);
  };
  const lostForeground = () => {
    sample.interrupted = true;
  };
  document.addEventListener("visibilitychange", lostForeground);
  window.addEventListener("blur", lostForeground);
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  motion.addEventListener("change", lostForeground);
  const collect = (type, entries) => {
    for (const entry of entries) {
      if (type === "long-animation-frame" && (entry.scripts?.length ?? 0) > 256) sample.truncated = true;
      if (type === "long-animation-frame")
        append(sample.longAnimationFrames, {
          start: entry.startTime,
          duration: entry.duration,
          blockingDuration: entry.blockingDuration,
          renderStart: entry.renderStart,
          styleAndLayoutStart: entry.styleAndLayoutStart,
          scripts: [...(entry.scripts ?? [])].slice(0, 256).map((script) => ({
            start: script.startTime,
            duration: script.duration,
            invoker: script.invoker,
            sourceURL: script.sourceURL,
            sourceFunctionName: script.sourceFunctionName,
            sourceCharPosition: script.sourceCharPosition,
            forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
          })),
        });
      else
        append(type === "event" ? sample.input : sample.longTasks, {
          name: entry.name,
          start: entry.startTime,
          duration: entry.duration,
          inputDelay: type === "event" ? entry.processingStart - entry.startTime : null,
        });
    }
  };
  const observers = [];
  for (const type of ["longtask", "event", "long-animation-frame"])
    if (supported.includes(type)) {
      const observer = new PerformanceObserver((list) => collect(type, list.getEntries()));
      observer.observe({ type, buffered: false, ...(type === "event" ? { durationThreshold: 16 } : {}) });
      observers.push({ observer, type });
    }
  const bridge = {
    begin: (name, details = {}) => {
      if (stopped || !recordSpans) return;
      if (sample.spans.length + open.size >= limit) {
        sample.truncated = true;
        return;
      }
      const id = ++serial;
      const span = {
        id,
        name: name.slice(0, 80),
        start: performance.now(),
        details: Object.fromEntries(
          Object.entries(details)
            .slice(0, 8)
            .map(([key, value]) => [
              key.slice(0, 40),
              typeof value === "string" ? value.slice(0, 120) : value,
            ]),
        ),
      };
      open.set(id, span);
      return (outcome = "complete") => {
        if (stopped || !open.delete(id)) return;
        append(sample.spans, { ...span, end: performance.now(), outcome });
      };
    },
  };
  window.faunaPerformanceCapture = bridge;
  const frame = (now) => {
    if (previous !== undefined)
      append(sample.frames, { start: previous, end: now, duration: now - previous });
    previous = now;
    handle = requestAnimationFrame(frame);
  };
  sample.markerStart = performance.mark("fauna-capture-start").startTime;
  const deadline = setTimeout(() => {
    sample.truncated = true;
    stop();
  }, 120000);
  const stop = () => {
    if (stopped) return sample;
    sample.end = performance.now();
    sample.markerEnd = performance.mark("fauna-capture-end").startTime;
    cancelAnimationFrame(handle);
    clearTimeout(deadline);
    for (const { observer, type } of observers) {
      collect(type, observer.takeRecords());
      observer.disconnect();
    }
    for (const span of open.values())
      append(sample.spans, { ...span, end: sample.end, outcome: "interrupted" });
    open.clear();
    if (pending) {
      append(sample.segments, {
        ...pending,
        end: sample.end,
        duration: sample.end - pending.start,
        frames: sample.frames.length - pending.frame,
        complete: false,
      });
      pending = undefined;
    }
    stopped = true;
    sample.after = snapshot();
    document.removeEventListener("visibilitychange", lostForeground);
    window.removeEventListener("blur", lostForeground);
    motion.removeEventListener("change", lostForeground);
    if (window.faunaPerformanceCapture === bridge) delete window.faunaPerformanceCapture;
    performance.clearMarks("fauna-capture-start");
    performance.clearMarks("fauna-capture-end");
    return sample;
  };
  window.faunaPerf = {
    sample,
    segment: (name) => {
      if (pending || stopped) throw new Error("Invalid capture segment lifecycle");
      pending = { name, start: performance.now(), frame: sample.frames.length };
    },
    end: () => {
      if (!pending || stopped) throw new Error("No active capture segment");
      const ended = performance.now();
      append(sample.segments, {
        ...pending,
        end: ended,
        duration: ended - pending.start,
        frames: sample.frames.length - pending.frame,
        complete: true,
      });
      pending = undefined;
    },
    stop,
  };
  handle = requestAnimationFrame(frame);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
