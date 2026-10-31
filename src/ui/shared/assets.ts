import prepared from "../../assets/prepared.json" with { type: "json" };
import type { SpeciesId } from "../../game/content";
export function assetUrl(id: string) {
  const records: Record<string, { url: string }> = prepared.records;
  const record = Object.hasOwn(records, id) ? records[id] : undefined;
  if (!record) throw new Error(`Missing prepared asset ${id}`);
  return record.url;
}

/** Preloading and rendering must resolve a minion to the same artwork. */
export function minionArtwork(kind: SpeciesId) {
  return kind === "tithemaw"
    ? "minion.gilded-ward"
    : kind === "chronora"
      ? "minion.pendulum"
      : kind === "velvetmonarch"
        ? "minion.royal-bloom"
        : "minion.echo";
}
