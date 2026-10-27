import { createHash } from "node:crypto";

// Keep the recorded gameplay oracle at format 57, excluding only dormant fields.
export const recordedTraceDigest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (key, entry) => {
        if (key === "version") return 57;
        if (key === "metronomeActor" && entry === null) return undefined;
        if (key === "fireThorns" && entry === 0) return undefined;
        if (key === "puzzleProgress" && Array.isArray(entry) && entry.length === 0) return undefined;
        if (key === "encoreProgress" && entry === 0) return undefined;
        if (key === "repeatNext" && entry.player === false && entry.enemy === false) return undefined;
        return entry;
      }),
    )
    .digest("hex");
