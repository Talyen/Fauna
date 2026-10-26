// Combined Boon and combat changes measured in hosted CI, October 26, 2026.
// See Docs/archive/BUNDLE_SIZE_HISTORY.md for build identities and allowance rationale.
export const BUNDLE_BUDGET = {
  baselineBytes: 943_153,
  maxBytes: 980 * 1024,
  warnBytes: Math.floor(980 * 1024 * 0.95),
};
