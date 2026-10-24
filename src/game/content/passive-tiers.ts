import type { PassiveTier, Species } from "./types";

/** Expand authored values into complete replacement tiers, in star-rank order. */
export function sixPassiveTiers(
  values: readonly [number, number, number, number, number, number],
  build: (amount: number) => PassiveTier,
): Species["passiveTiers"] {
  return [
    build(values[0]),
    build(values[1]),
    build(values[2]),
    build(values[3]),
    build(values[4]),
    build(values[5]),
  ];
}
