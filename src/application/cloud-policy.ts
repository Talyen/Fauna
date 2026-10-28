import type { CloudSnapshot } from "./cloud-snapshots";

/** Last duplicate wins without changing its original position; only ancestry retires a head. */
export function newestHeads(records: readonly CloudSnapshot[]) {
  if (!records.length) return [];
  if (records.length === 1) {
    const record = records[0]!;
    return record.ancestors.includes(record.id) ? [] : [record];
  }
  const byId = new Map<string, CloudSnapshot>();
  for (const record of records) byId.set(record.id, record);
  const unique = [...byId.values()];
  const ancestors = new Set<string>();
  for (const record of unique) for (const ancestor of record.ancestors) ancestors.add(ancestor);
  let kept = 0;
  for (const record of unique) if (!ancestors.has(record.id)) unique[kept++] = record;
  unique.length = kept;
  return unique;
}

/** Sequence counters select device slots; ancestry alone retires competing progress. */
export function reconciliationPlan({
  current,
  remote,
  localData,
  mode,
}: {
  current: CloudSnapshot | null;
  remote: readonly CloudSnapshot[];
  localData: string | null;
  mode: "startup" | "background";
}) {
  const records = [...remote];
  if (current) records.push(current);
  if (mode === "background" && !current)
    return { records, chosen: null, parents: [], preserve: false, install: null, deferred: true };
  const heads = newestHeads(records);
  const chosen =
    (mode === "background" ? current : null) ??
    (current ? heads.find((head) => head.id === current.id) : undefined) ??
    heads.reduce<CloudSnapshot | undefined>(
      (first, head) => (!first || head.id.localeCompare(first.id) < 0 ? head : first),
      undefined,
    ) ??
    null;
  const install = chosen && mode === "startup" && localData !== chosen.payload ? chosen.payload : null;
  return {
    records,
    chosen,
    parents: mode === "background" || heads.length > 1 ? heads : chosen ? [chosen] : [],
    preserve:
      !!chosen &&
      (heads.length > 1 ||
        (mode === "background" && !heads.some((head) => head.id === chosen.id)) ||
        install !== null),
    install,
    deferred: false,
  };
}
