import type { DiagnosticPort } from "../platform/ports";
export type DiagnosticSource =
  "startup" | "render" | "save-read" | "save-write" | "validation" | "audio" | "cloud" | "global";
export interface Diagnostic {
  source: DiagnosticSource;
  message: string;
  count: number;
  revision?: number;
  phase?: string;
}
const sanitize = (value: string) =>
  value
    .replace(/(?:\/[\w .-]+){2,}\/|[A-Z]:\\(?:[^\\\n]+\\)+/g, "[path]/")
    .replace(
      /(?:token|password|secret|authorization)["']?\s*[:=]\s*(?:(?:Bearer|Basic)\s+)?(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\S+)/gi,
      "[redacted]",
    )
    .slice(0, 1200);

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
    const raw = port?.read();
    if (raw && raw.length < 100_000) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed))
        entries = retain(
          parsed.slice(-50).flatMap((entry) => {
            if (
              !entry ||
              typeof entry.message !== "string" ||
              ![
                "startup",
                "render",
                "save-read",
                "save-write",
                "validation",
                "audio",
                "cloud",
                "global",
              ].includes(entry.source)
            )
              return [];
            return [
              {
                source: entry.source,
                message: sanitize(entry.message),
                count:
                  Number.isSafeInteger(entry.count) && entry.count > 0 ? Math.min(entry.count, 1_000_000) : 1,
                ...(Number.isSafeInteger(entry.revision) && typeof entry.phase === "string"
                  ? { revision: entry.revision, phase: entry.phase.slice(0, 40) }
                  : {}),
              },
            ];
          }),
        );
    }
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
              count: Math.min((match?.count ?? 0) + 1, 1_000_000),
              ...(context ? { revision: context.revision, phase: context.phase } : {}),
            },
          ].slice(-50),
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
