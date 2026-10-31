// The larger hosted localization build plus measured headroom.
// See Docs/archive/BUNDLE_SIZE_HISTORY.md for build identities and allowance rationale.
export const BUNDLE_BUDGET = {
  baselineBytes: 3_432_877,
  maxBytes: 3584 * 1024,
  warnBytes: Math.floor(3584 * 1024 * 0.95),
};
