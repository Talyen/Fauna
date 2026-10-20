import prepared from "../assets/prepared.json";
export function assetUrl(id: string) {
  const records: Record<string, { url: string }> = prepared.records;
  const record = Object.hasOwn(records, id) ? records[id] : undefined;
  if (!record) throw new Error(`Missing prepared asset ${id}`);
  return record.url;
}
