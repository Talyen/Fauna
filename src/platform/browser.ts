import saveFormat from "../game/save-format.json" with { type: "json" };
import { browserDiagnostics } from "./preferences";
import type { Platform, SaveCandidate } from "./ports";
const KEY = "fauna.save.v1";
let textEncoder: TextEncoder | undefined;
export function createBrowserPlatform(storage?: Storage): Platform {
  return {
    desktop: false,
    diagnostics: browserDiagnostics(storage),
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
        if (
          data.length > saveFormat.maxBytes ||
          (data.length > Math.floor(saveFormat.maxBytes / 3) &&
            (textEncoder ??= new TextEncoder()).encode(data).length > saveFormat.maxBytes)
        )
          throw new Error("Invalid save payload.");
        const source = storage ?? window.localStorage;
        // Only application-approved checkpoints may displace recovery slots.
        const readable = new Map<string, string | null>();
        const intact: string[] = [];
        for (const key of [KEY, `${KEY}.backup1`, `${KEY}.backup2`]) {
          let previous: string | null;
          try {
            previous = source.getItem(key);
            readable.set(key, previous);
          } catch (error) {
            // Never replace an unknown primary or overwrite an inaccessible backup.
            if (key === KEY) throw error;
            continue;
          }
          if (previous === null) continue;
          try {
            if (isRecoverable(previous) && !intact.includes(previous)) intact.push(previous);
          } catch {
            // A failed validation cannot promote this checkpoint into recovery storage.
          }
        }
        const backups = [`${KEY}.backup1`, `${KEY}.backup2`].filter((key) => readable.has(key));
        // Choose against successful writes, so a failed rotation cannot duplicate
        // the remaining recovery slot or displace its only distinct checkpoint.
        for (const key of backups) {
          const checkpoint = intact.find(
            (data) => !backups.some((other) => other !== key && readable.get(other) === data),
          );
          if (checkpoint !== undefined && checkpoint !== readable.get(key)) {
            try {
              source.setItem(key, checkpoint);
              readable.set(key, checkpoint);
            } catch {
              // Backup growth may exceed quota while replacing the primary still fits.
              // A failed setItem leaves the existing recovery slot intact.
            }
          }
        }
        source.setItem(KEY, data);
      },
    },
  };
}
