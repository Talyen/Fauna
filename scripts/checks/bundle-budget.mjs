// The last measured English build plus an estimated allowance for seven catalogs.
// See Docs/archive/BUNDLE_SIZE_HISTORY.md for build identities and allowance rationale.
export const BUNDLE_BUDGET = {
  baselineBytes: 991_285,
  maxBytes: 3328 * 1024,
  warnBytes: Math.floor(3328 * 1024 * 0.95),
};
