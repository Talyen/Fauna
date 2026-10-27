import weights from "./lineup-weights.json" with { type: "json" };

export const LINEUP_SHARDS = 16;

/** Partition registered cases, preserving each scenario's seed and assertions. */
export function lineupShard(scenarios, shard, schedule = "round-robin") {
  if (!["round-robin", "balanced"].includes(schedule)) throw new Error("Invalid lineup schedule");
  if (shard === undefined) return scenarios;
  if (!/^[1-9]\d*$/.test(shard) || Number(shard) > LINEUP_SHARDS)
    throw new Error(`Invalid lineup shard; expected 1 through ${LINEUP_SHARDS}`);
  if (schedule === "round-robin")
    return scenarios.filter((_, index) => index % LINEUP_SHARDS === Number(shard) - 1);
  const groups = Array.from({ length: LINEUP_SHARDS }, () => ({ total: 0, cases: [] }));
  const sorted = scenarios.map((scenario) => {
    if (typeof scenario.name !== "string") throw new Error("Missing lineup identity");
    const estimate = scenario.name.split(", ").reduce((sum, name) => {
      const value = Object.hasOwn(weights.creatures, name) ? weights.creatures[name] : weights.defaultMs;
      if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid lineup estimate");
      return sum + value;
    }, 0);
    return { scenario, estimate };
  });
  if (new Set(sorted.map(({ scenario }) => scenario.name)).size !== sorted.length)
    throw new Error("Duplicate lineup identity");
  sorted.sort((a, b) => b.estimate - a.estimate || a.scenario.name.localeCompare(b.scenario.name, "en"));
  for (const row of sorted) {
    const group = groups.reduce((a, b) => (a.total <= b.total ? a : b));
    group.total += row.estimate;
    group.cases.push(row.scenario);
  }
  return groups[Number(shard) - 1].cases;
}
