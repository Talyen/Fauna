export const LINEUP_SHARDS: 16;
export function lineupShard<T extends { name: string }>(
  scenarios: T[],
  shard: string | undefined,
  schedule?: string,
): T[];
