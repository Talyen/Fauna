import type { CloudSnapshot } from "./cloud-snapshots";

export function newestHeads(records: readonly CloudSnapshot[]) {
  const unique = [...new Map(records.map((record) => [record.id, record])).values()];
  const ancestors = new Set<string>();
  for (const record of unique) for (const ancestor of record.ancestors) ancestors.add(ancestor);
  return unique.filter((record) => !ancestors.has(record.id));
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
  const records = [...remote, ...(current ? [current] : [])];
  const heads = newestHeads(records);
  if (mode === "background" && !current)
    return { records, chosen: null, parents: [], preserve: false, install: null, deferred: true };
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
