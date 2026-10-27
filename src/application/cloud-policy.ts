import type { CloudSnapshot } from "./cloud-snapshots";

export function newestHeads(records: readonly CloudSnapshot[]) {
  if (records.length === 0) return [];
  if (records.length === 1) return records[0]!.ancestors.includes(records[0]!.id) ? [] : records.slice();
  if (records.length === 2) {
    const [first, last] = records as readonly [CloudSnapshot, CloudSnapshot];
    if (first.id === last.id) return last.ancestors.includes(last.id) ? [] : [last];
    const heads: CloudSnapshot[] = [];
    if (!first.ancestors.includes(first.id) && !last.ancestors.includes(first.id)) heads.push(first);
    if (!first.ancestors.includes(last.id) && !last.ancestors.includes(last.id)) heads.push(last);
    return heads;
  }
  const byId = new Map<string, CloudSnapshot>();
  for (const record of records) byId.set(record.id, record);
  const unique = [...byId.values()];
  if (unique.length === 1) return unique[0]!.ancestors.includes(unique[0]!.id) ? [] : unique;
  let ancestors: Set<string> | undefined;
  for (const record of unique)
    for (const ancestor of record.ancestors) (ancestors ??= new Set()).add(ancestor);
  const knownAncestors = ancestors;
  return knownAncestors ? unique.filter((record) => !knownAncestors.has(record.id)) : unique;
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
    heads.find((head) => head.id === current?.id) ??
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
