import { browserDiagnostics } from "./preferences";
import type { Platform, SaveCandidate } from "./ports";
const KEY = "fauna.save.v1";
export function createBrowserPlatform(storage?: Storage): Platform {
  return {
    desktop: false,
    diagnostics: browserDiagnostics(),
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
        const intact = [KEY, `${KEY}.backup1`, `${KEY}.backup2`].flatMap((key) => {
          const previous = source.getItem(key);
          if (previous === null) return [];
          try {
            return isRecoverable(previous) ? [previous] : [];
          } catch {
            return [];
          }
        });
        if (intact[1] !== undefined) source.setItem(`${KEY}.backup2`, intact[1]);
        if (intact[0] !== undefined) source.setItem(`${KEY}.backup1`, intact[0]);
        source.setItem(KEY, data);
      },
    },
  };
}
