import prepared from "../../assets/prepared.json" with { type: "json" };
import type { SpeciesId } from "../../game/content";
type Asset = { url: string; width?: number; height?: number };
const records: Record<string, Asset> = prepared.records;
const artworkByUrl = new Map(Object.values(records).map((record) => [record.url, record]));

export function assetUrl(id: string) {
  const record = Object.hasOwn(records, id) ? records[id] : undefined;
  if (!record) throw new Error(`Missing prepared asset ${id}`);
  return record.url;
}

/** Source pixels, never print DPI; vectors have no raster size limit. */
export function artworkWidth(url: string, aspect: "creature" | "action") {
  const record = artworkByUrl.get(url);
  if (!record?.width || !record.height || url.endsWith(".svg")) return undefined;
  return Math.min(record.width, record.height * (aspect === "creature" ? 4 / 3 : 3 / 4));
}

/** One pixel budget preserves the combatant/hand proportions when artwork is capped. */
export const battleArtworkLongEdge = Math.min(
  ...Object.entries(records).flatMap(([id, record]) => {
    if (!/^(creature|action|minion|pile|card)\./.test(id)) return [];
    const portrait = !id.startsWith("creature.") && !id.startsWith("minion.");
    const width = artworkWidth(record.url, portrait ? "action" : "creature");
    return width === undefined ? [] : [portrait ? (width * 4) / 3 : width];
  }),
);

export const manaArtworkPixels = Math.min(
  ...["mana.full", "mana.empty"].map((id) => Math.min(records[id]!.width!, records[id]!.height!)),
);

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
