export const LINEUP_SHARDS = 16;

/** Partition registered cases, preserving each scenario's seed and assertions. */
export function lineupShard(scenarios, shard) {
  if (shard === undefined) return scenarios;
  if (!/^[1-9]\d*$/.test(shard) || Number(shard) > LINEUP_SHARDS)
    throw new Error(`Invalid lineup shard; expected 1 through ${LINEUP_SHARDS}`);
  return scenarios.filter((_, index) => index % LINEUP_SHARDS === Number(shard) - 1);
}
