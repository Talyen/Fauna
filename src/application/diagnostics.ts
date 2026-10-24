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
  revision: z.number().int().optional().catch(undefined),
  phase: z.string().optional().catch(undefined),
});
const sanitize = (value: string) =>
  value
    .replace(/(?:\/[\w .-]+){2,}\/|[A-Z]:\\(?:[^\\\n]+\\)+/g, "[path]/")
    .replace(
      /(?:token|password|secret|authorization)["']?\s*[:=]\s*(?:(?:Bearer|Basic)\s+)?(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+)/gi,
      "[redacted]",
    )
    .slice(0, MAX_MESSAGE_LENGTH);

function readEntries(raw: string | null | undefined): Diagnostic[] {
  if (!raw || raw.length >= MAX_STORED_LENGTH) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(-MAX_ENTRIES).flatMap((entry: unknown) => {
    const result = storedDiagnostic.safeParse(entry);
    if (!result.success) return [];
    const { source, message, count, revision, phase } = result.data;
    return [
      {
        source,
        message: sanitize(message),
        count: Math.min(count, MAX_COUNT),
        ...(revision !== undefined && phase !== undefined
          ? { revision, phase: phase.slice(0, MAX_PHASE_LENGTH) }
          : {}),
      },
    ];
  });
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
  const retain = (values: Diagnostic[]) => Object.freeze(values.map((entry) => Object.freeze(entry)));
  let entries = retain([]);
  let disposed = false,
    writing = false;
  const listeners = new Set<() => void>();
  try {
    entries = retain(readEntries(port?.read()));
  } catch {
    /* Diagnostics remain usable when optional persistence fails. */
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
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
        const match = entries.find((entry) => entry.source === source && entry.message === message);
        entries = retain(
          [
            ...entries.filter((entry) => entry !== match),
            {
              source,
              message,
              count: Math.min((match?.count ?? 0) + 1, MAX_COUNT),
              ...(context
                ? { revision: context.revision, phase: context.phase.slice(0, MAX_PHASE_LENGTH) }
                : {}),
            },
          ].slice(-MAX_ENTRIES),
        );
        try {
          port?.write(JSON.stringify(entries));
        } catch {
          /* Preserve in-memory evidence. */
        }
        for (const listener of listeners) {
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
