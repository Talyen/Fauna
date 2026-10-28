import { createHash } from "node:crypto";

// Keep the recorded gameplay oracle at format 57, excluding only dormant fields.
// The original combat shape had a dormant Water Thorns field immediately after Thorns.
export const recordedTraceDigest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (key, entry) => {
        // Presentation metadata does not change the recorded combat facts or text.
        if (key === "announcement" && entry?.kind === "useAbility") return undefined;
        if (key === "version") return 57;
        if (
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          Object.hasOwn(entry, "thorns") &&
          Object.hasOwn(entry, "temporaryDodge")
        )
          return Object.fromEntries(
            Object.entries(entry).flatMap(([name, item]) =>
              name === "thorns"
                ? [
                    [name, item],
                    ["waterThorns", 0],
                  ]
                : [[name, item]],
            ),
          );
        if (key === "metronomeActor" && entry === null) return undefined;
        if (key === "fireThorns" && entry === 0) return undefined;
        if (key === "puzzleProgress" && Array.isArray(entry) && entry.length === 0) return undefined;
        if (key === "encoreProgress" && entry === 0) return undefined;
        if (["oasisLeech", "acrobatReady", "moonseedReady", "toothpickReady"].includes(key) && entry === false)
          return undefined;
        if (key === "slipperCard" && entry === null) return undefined;
        if (key === "repeatNext" && entry.player === false && entry.enemy === false) return undefined;
        return entry;
      }),
    )
    .digest("hex");
