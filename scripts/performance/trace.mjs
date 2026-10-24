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
    await client.detach();
    throw new Error(`Deep tracing unavailable: ${error.message}`);
  }
  let done = false;
  return async () => {
    if (done) return null;
    done = true;
    let timer, stream;
    const chunks = [];
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
      await writeFile(file, raw);
      if (full || result.dataLossOccurred) throw new Error("Trace dropped events or exhausted its buffer");
      return JSON.parse(raw.toString("utf8"));
    } catch (error) {
      if (chunks.length) await writeFile(`${file}.partial`, Buffer.concat(chunks));
      throw error;
    } finally {
      clearTimeout(timer);
      if (stream) await client.send("IO.close", { handle: stream }).catch(() => {});
      await client.detach();
    }
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
  const events = trace.traceEvents ?? [];
  if (trace.dataLossOccurred || events.length > 200000)
    return { available: false, reason: "Incomplete trace or attribution event budget exceeded" };
  const start = events.find((event) => event.name === "fauna-capture-start");
  const end = events.find(
    (event) => event.name === "fauna-capture-end" && event.pid === start?.pid && event.tid === start?.tid,
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
  const spans = [],
    stack = [];
  for (const event of events
    .filter((event) => event.pid === start.pid && event.tid === start.tid)
    .sort((a, b) => a.ts - b.ts)) {
    if (event.ph === "B") stack.push(event);
    if (event.ph === "E") {
      const begin = stack.pop();
      if (begin && category(begin.name)) spans.push({ ...begin, dur: event.ts - begin.ts });
    }
    if (
      event.ph === "X" &&
      Number.isFinite(event.ts) &&
      Number.isFinite(event.dur) &&
      event.dur >= 0 &&
      category(event.name)
    )
      spans.push(event);
  }
  const intervals = spans.map((event) => ({
    start: event.ts / 1000 - offset,
    end: (event.ts + event.dur) / 1000 - offset,
    category: category(event.name),
    name: event.args?.data?.functionName || event.name,
    url: event.args?.data?.url ?? event.args?.data?.scriptName ?? null,
    line: event.args?.data?.lineNumber ?? null,
  }));
  if (
    hitches.some(
      (gap) => intervals.filter((entry) => entry.start < gap.end && entry.end > gap.start).length > 1000,
    )
  )
    return { available: false, reason: "Per-hitch attribution work budget exceeded" };
  return {
    available: true,
    thread: { pid: start.pid, tid: start.tid },
    hitches: hitches.map((gap) => {
      const overlapping = intervals.filter((entry) => entry.start < gap.end && entry.end > gap.start);
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
        const inner = overlapping
          .filter((entry) => entry.start <= low && entry.end >= high)
          .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
        if (!inner) continue;
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
