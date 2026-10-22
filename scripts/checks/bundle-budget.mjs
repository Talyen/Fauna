// Stable-stack upgrade measured in hosted CI, October 21, 2026.
// See Docs/archive/BUNDLE_SIZE_HISTORY.md for build identities and allowance rationale.
export const BUNDLE_BUDGET = {
  baselineBytes: 774_677,
  maxBytes: 800 * 1024,
  warnBytes: Math.floor(800 * 1024 * 0.95),
};
