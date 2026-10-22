import { browserDiagnostics } from "./preferences";
import type { Platform, SaveCandidate } from "./ports";
const KEY = "fauna.save.v1";
export function createBrowserPlatform(storage?: Storage): Platform {
  return {
    desktop: false,
    diagnostics: browserDiagnostics(storage),
    steam: { available: false },
    saves: {
      async readCandidates() {
        const source = storage ?? window.localStorage;
        const results: SaveCandidate[] = [];
        const failures: unknown[] = [];
        for (const key of [KEY, `${KEY}.backup1`, `${KEY}.backup2`]) {
          try {
            const data = source.getItem(key);
            if (data !== null) results.push({ source: key === KEY ? "primary" : "backup", data });
          } catch (error) {
            failures.push(error);
          }
        }
        if (failures.length && !results.length)
          throw new AggregateError(failures, "Save slots are unreadable.");
        return results;
      },
      async write(data, isRecoverable = () => false) {
        const source = storage ?? window.localStorage;
        // Only application-approved checkpoints may displace recovery slots.
        const readable = new Set<string>();
        const intact: string[] = [];
        for (const key of [KEY, `${KEY}.backup1`, `${KEY}.backup2`]) {
          let previous: string | null;
          try {
            previous = source.getItem(key);
            readable.add(key);
          } catch (error) {
            // Never replace an unknown primary or overwrite an inaccessible backup.
            if (key === KEY) throw error;
            continue;
          }
          if (previous === null) continue;
          try {
            if (isRecoverable(previous)) intact.push(previous);
          } catch {
            // A failed validation cannot promote this checkpoint into recovery storage.
          }
        }
        const backups = [`${KEY}.backup1`, `${KEY}.backup2`].filter((key) => readable.has(key));
        for (let index = backups.length - 1; index >= 0; index--)
          if (intact[index] !== undefined) {
            try {
              source.setItem(backups[index]!, intact[index]!);
            } catch {
              // Backup growth may exceed quota while replacing the primary still fits.
              // A failed setItem leaves the existing recovery slot intact.
            }
          }
        source.setItem(KEY, data);
      },
    },
  };
}
