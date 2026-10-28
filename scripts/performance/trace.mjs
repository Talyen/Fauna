import { writeFile } from "node:fs/promises";

export async function beginTrace(page, file) {
  const client = await page.context().newCDPSession(page);
  let full = false;
  client.on("Tracing.bufferUsage", (entry) => {
    if (entry.percentFull >= 0.95) full = true;
  });
  try {
    await client.send("Tracing.start", {
      categories:
        "devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler",
      transferMode: "ReturnAsStream",
      bufferUsageReportingInterval: 500,
    });
  } catch (error) {
    await client.detach().catch(() => {});
    throw new Error(`Deep tracing unavailable: ${error.message}`, { cause: error });
  }
  let done = false;
  return async () => {
    if (done) return null;
    done = true;
    let timer, stream, resultTrace;
    const chunks = [];
    const failures = [];
    try {
      const complete = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Trace flush timed out")), 10000);
        client.once("Tracing.tracingComplete", resolve);
      });
      void complete.catch(() => {});
      await client.send("Tracing.end");
      const result = await complete;
      stream = result.stream;
      if (!stream) throw new Error("Trace stream unavailable");
      let size = 0;
      for (;;) {
        const chunk = await client.send("IO.read", { handle: stream, size: 65536 });
        const bytes = Buffer.from(chunk.data, chunk.base64Encoded ? "base64" : "utf8");
        size += bytes.length;
        if (size > 32 * 1024 * 1024) throw new Error("Trace exceeded 32 MiB evidence budget");
        chunks.push(bytes);
        if (chunk.eof) break;
      }
      const raw = Buffer.concat(chunks);
      if (full || result.dataLossOccurred) throw new Error("Trace dropped events or exhausted its buffer");
      const trace = JSON.parse(raw.toString("utf8"));
      if (!Array.isArray(trace?.traceEvents)) throw new Error("Invalid trace event stream");
      await writeFile(file, raw);
      resultTrace = trace;
    } catch (error) {
      failures.push(error);
      if (chunks.length)
        await writeFile(`${file}.partial`, Buffer.concat(chunks)).catch((failure) => failures.push(failure));
    } finally {
      clearTimeout(timer);
      if (stream) await client.send("IO.close", { handle: stream }).catch((error) => failures.push(error));
      await client.detach().catch((error) => failures.push(error));
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, failures.map((error) => error.message).join("; "));
    return resultTrace;
  };
}

const category = (name) =>
  /Layout|RecalculateStyles|UpdateLayoutTree/.test(name)
    ? "style/layout"
    : /Paint|Raster|CompositeLayers/.test(name)
      ? "paint"
      : /GC|CollectGarbage/.test(name)
        ? "garbage collection"
        : /FunctionCall|EvaluateScript|RunMicrotasks|v8.execute|V8.Execute/.test(name)
          ? "script"
          : null;

/** Clip to the marked renderer thread; only exclusive innermost work is added to totals. */
export function attributeTrace(trace, sample, hitches) {
  const events = trace?.traceEvents;
  if (!Array.isArray(events) || trace.dataLossOccurred || events.length > 200000)
    return { available: false, reason: "Incomplete trace or attribution event budget exceeded" };
  if (
    !Array.isArray(hitches) ||
    hitches.length > 20 ||
    hitches.some(
      (gap) =>
        !gap ||
        !Number.isFinite(gap.start) ||
        gap.start < 0 ||
        !Number.isFinite(gap.end) ||
        !Number.isFinite(gap.duration) ||
        gap.duration <= 0 ||
        gap.end <= gap.start ||
        Math.abs(gap.end - gap.start - gap.duration) > 0.01,
    )
  )
    return { available: false, reason: "Invalid hitch intervals or attribution budget exceeded" };
  const start = events.find((event) => event?.name === "fauna-capture-start");
  const end = events.find(
    (event) => event?.name === "fauna-capture-end" && event.pid === start?.pid && event.tid === start?.tid,
  );
  if (
    !start ||
    !end ||
    !Number.isFinite(start.ts) ||
    !Number.isFinite(end.ts) ||
    !Number.isInteger(start.pid) ||
    !Number.isInteger(start.tid) ||
    end.ts <= start.ts ||
    !Number.isFinite(sample.markerStart) ||
    !Number.isFinite(sample.markerEnd) ||
    sample.markerEnd <= sample.markerStart
  )
    return { available: false, reason: "Missing renderer synchronization markers" };
  const offset = start.ts / 1000 - sample.markerStart;
  if (Math.abs(end.ts / 1000 - offset - sample.markerEnd) > 5)
    return { available: false, reason: "Trace and renderer clocks did not align" };
  if (
    events.some(
      (event) =>
        event?.pid === start.pid &&
        event.tid === start.tid &&
        ["B", "E", "X"].includes(event.ph) &&
        (!Number.isFinite(event.ts) ||
          (event.ph === "X" &&
            (!Number.isFinite(event.dur) || event.dur < 0 || !Number.isFinite(event.ts + event.dur)))),
    )
  )
    return { available: false, reason: "Invalid renderer trace interval" };
  const spans = [],
    stack = [];
  for (const event of events
    .filter(
      (event) => event && Number.isFinite(event.ts) && event.pid === start.pid && event.tid === start.tid,
    )
    .sort((a, b) => a.ts - b.ts)) {
    if (event.ph === "B") stack.push(event);
    if (event.ph === "E") {
      const begin = stack.pop();
      if (!begin) return { available: false, reason: "Unmatched renderer trace interval" };
      const duration = event.ts - begin.ts;
      if (!Number.isFinite(duration) || duration < 0)
        return { available: false, reason: "Invalid renderer trace interval" };
      spans.push({ ...begin, dur: duration });
    }
    if (
      event.ph === "X" &&
      Number.isFinite(event.ts) &&
      Number.isFinite(event.dur) &&
      event.dur >= 0 &&
      Number.isFinite(event.ts + event.dur)
    )
      spans.push(event);
  }
  if (stack.length) return { available: false, reason: "Unmatched renderer trace interval" };
  const intervals = spans.map((event) => ({
    start: event.ts / 1000 - offset,
    end: (event.ts + event.dur) / 1000 - offset,
    category: category(event.name),
    name: event.args?.data?.functionName || event.name,
    url: event.args?.data?.url ?? event.args?.data?.scriptName ?? null,
    line: event.args?.data?.lineNumber ?? null,
  }));
  const candidates = [];
  for (const gap of hitches) {
    const overlapping = [];
    for (const entry of intervals) {
      if (entry.start >= gap.end || entry.end <= gap.start) continue;
      overlapping.push(entry);
      if (overlapping.length > 1000)
        return { available: false, reason: "Per-hitch attribution work budget exceeded" };
    }
    candidates.push(overlapping);
  }
  return {
    available: true,
    thread: { pid: start.pid, tid: start.tid },
    hitches: hitches.map((gap, index) => {
      const overlapping = candidates[index];
      const boundaries = [
        ...new Set([
          gap.start,
          gap.end,
          ...overlapping.flatMap((entry) => [Math.max(gap.start, entry.start), Math.min(gap.end, entry.end)]),
        ]),
      ].sort((a, b) => a - b);
      const work = new Map();
      for (let i = 1; i < boundaries.length; i++) {
        const low = boundaries[i - 1],
          high = boundaries[i];
        let inner;
        for (const entry of overlapping)
          if (
            entry.start <= low &&
            entry.end >= high &&
            (!inner || entry.end - entry.start < inner.end - inner.start)
          )
            inner = entry;
        // Unknown nested work must remain unaccounted, not inherit its parent's category.
        if (!inner?.category) continue;
        const key = JSON.stringify([inner.category, inner.name, inner.url, inner.line]);
        const row = work.get(key) ?? {
          category: inner.category,
          name: inner.name,
          url: inner.url,
          line: inner.line,
          selfMs: 0,
        };
        row.selfMs += high - low;
        work.set(key, row);
      }
      const rows = [...work.values()].sort((a, b) => b.selfMs - a.selfMs);
      return {
        start: gap.start,
        end: gap.end,
        work: rows.slice(0, 20),
        unaccountedMs: Math.max(0, gap.duration - rows.reduce((sum, row) => sum + row.selfMs, 0)),
      };
    }),
  };
}
