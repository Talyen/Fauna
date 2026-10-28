import { z } from "zod";
import type { DiagnosticPort } from "../platform/ports";
const diagnosticSource = z.enum([
  "startup",
  "render",
  "save-read",
  "save-write",
  "validation",
  "audio",
  "cloud",
  "global",
]);
export type DiagnosticSource = z.infer<typeof diagnosticSource>;
export interface Diagnostic {
  readonly source: DiagnosticSource;
  readonly message: string;
  readonly count: number;
  readonly revision?: number;
  readonly phase?: string;
}
const MAX_ENTRIES = 50;
const MAX_COUNT = 1_000_000;
const MAX_STORED_LENGTH = 100_000;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_PHASE_LENGTH = 40;
const storedDiagnostic = z.object({
  source: diagnosticSource,
  message: z.string(),
  count: z.number().int().positive().catch(1),
  revision: z.number().int().min(0).optional().catch(undefined),
  phase: z.string().optional().catch(undefined),
});
const sanitize = (value: string) =>
  value
    .replace(/\b(https?:\/\/)[^\s/@]+@/gi, "$1[redacted]@")
    .replace(
      /\b(?:set-cookie|cookie)["']?\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n]*)/gi,
      "[redacted]",
    )
    .replace(/\bBasic[ \t]+([A-Za-z0-9+/]+={0,2})(?![A-Za-z0-9+/=])/gi, (match, credential: string) => {
      try {
        return atob(credential).includes(":") ? "[redacted]" : match;
      } catch {
        return match;
      }
    })
    .replace(/\bBearer[ \t]+[^\s,;"']+/gi, "[redacted]")
    .replace(/\b[A-Za-z]:\\[^"'\r\n<>|?*,;]*/g, "[path]")
    .replace(/(?:\/[^/\r\n]+){2,}\//g, "[path]/")
    .replace(/\\\\[^\\\r\n]+\\[^\\\r\n]+(?:\\[^\\\r\n]+)*/g, "[path]")
    .replace(/(?:\/[^/\r\n]+){2,}$/gm, "[path]")
    .replace(
      /(?:token|password|secret|authorization|api[_-]?key)["']?\s*[:=]\s*(?:(?:Bearer|Basic)\s+)?(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+)/gi,
      "[redacted]",
    )
    .slice(0, MAX_MESSAGE_LENGTH);

function readEntries(raw: string | null | undefined): Diagnostic[] {
  if (!raw || raw.length >= MAX_STORED_LENGTH) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const entries: Diagnostic[] = [];
  for (let index = Math.max(0, parsed.length - MAX_ENTRIES); index < parsed.length; index++) {
    const result = storedDiagnostic.safeParse(parsed[index]);
    if (!result.success) continue;
    const { source, message, count, revision, phase } = result.data;
    entries.push({
      source,
      message: sanitize(message),
      count: Math.min(count, MAX_COUNT),
      ...(revision !== undefined && phase !== undefined
        ? { revision, phase: sanitize(phase).slice(0, MAX_PHASE_LENGTH) }
        : {}),
    });
  }
  return entries;
}

function errorMessage(error: unknown): string {
  try {
    const message: unknown = error instanceof Error ? error.message : error;
    if (typeof message === "string") return message;
  } catch {
    // Thrown values can expose getters or proxies that fail during inspection.
  }
  return "Unknown failure";
}

export function createDiagnostics(port?: DiagnosticPort) {
  const retain = (values: Diagnostic[]) => {
    // JSON escaping can cost six characters per message character. Bound the stored form too.
    // Every caller supplies a fresh private array; published snapshots are never passed back in.
    const bounded = values;
    if (bounded.length > MAX_ENTRIES) bounded.splice(0, bounded.length - MAX_ENTRIES);
    let serialized = JSON.stringify(bounded);
    if (serialized.length >= MAX_STORED_LENGTH) {
      let storedLength = 2 + Math.max(0, bounded.length - 1);
      const lengths = bounded.map((entry) => JSON.stringify(entry).length);
      for (const length of lengths) storedLength += length;
      let removed = 0;
      while (storedLength >= MAX_STORED_LENGTH) {
        storedLength -= lengths[removed++]!;
        if (removed < bounded.length) storedLength--;
      }
      bounded.splice(0, removed);
      serialized = JSON.stringify(bounded);
    }
    for (const entry of bounded) Object.freeze(entry);
    return { entries: Object.freeze(bounded), serialized };
  };
  let entries = retain([]).entries;
  let disposed = false,
    writing = false;
  const listeners = new Set<() => void>();
  try {
    entries = retain(readEntries(port?.read())).entries;
  } catch {
    /* Diagnostics remain usable when optional persistence fails. */
  }
  return {
    subscribe(listener: () => void) {
      if (disposed) return () => {};
      const subscription = () => listener();
      listeners.add(subscription);
      return () => {
        listeners.delete(subscription);
      };
    },
    snapshot: () => entries,
    record(source: DiagnosticSource, error: unknown, context?: { revision: number; phase: string }) {
      if (disposed || writing) return;
      // Own the operation before error inspection can invoke user-defined getters.
      writing = true;
      try {
        // Never stringify arbitrary error context or full save payloads.
        const message = sanitize(errorMessage(error));
        // Error getters can dispose the owner while the message is being inspected.
        if (disposed) return;
        let location: Pick<Diagnostic, "revision" | "phase"> = {};
        try {
          if (context) {
            const revision = context.revision;
            const phase = sanitize(context.phase).slice(0, MAX_PHASE_LENGTH);
            if (Number.isSafeInteger(revision) && revision >= 0) location = { revision, phase };
          }
        } catch {
          // Optional diagnostic context cannot suppress the original failure.
        }
        if (disposed) return;
        const index = entries.findIndex((entry) => entry.source === source && entry.message === message);
        const match = entries[index];
        const next = entries.slice();
        if (index >= 0) next.splice(index, 1);
        next.push({
          source,
          message,
          count: Math.min((match?.count ?? 0) + 1, MAX_COUNT),
          ...location,
        });
        const retained = retain(next);
        entries = retained.entries;
        // Capture delivery ownership before persistence or listeners can register new viewers.
        const notification = [...listeners];
        try {
          port?.write(retained.serialized);
        } catch {
          /* Preserve in-memory evidence. */
        }
        for (const listener of notification) {
          if (!listeners.has(listener)) continue;
          try {
            listener();
          } catch {
            /* A broken viewer cannot disable collection. */
          }
        }
      } finally {
        writing = false;
      }
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
}
export type Diagnostics = ReturnType<typeof createDiagnostics>;
