export const LINEUP_SHARDS = 4;

/** Partition registered cases, preserving each scenario's seed and assertions. */
export function lineupShard(scenarios, shard) {
  if (shard === undefined) return scenarios;
  if (!/^[1-4]$/.test(shard)) throw new Error("Invalid lineup shard; expected 1 through 4");
  return scenarios.filter((_, index) => index % LINEUP_SHARDS === Number(shard) - 1);
}
