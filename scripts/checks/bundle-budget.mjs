// Modifier ownership and parameters measured in hosted CI, October 23, 2026.
// See Docs/archive/BUNDLE_SIZE_HISTORY.md for build identities and allowance rationale.
export const BUNDLE_BUDGET = {
  baselineBytes: 887_248,
  maxBytes: 920 * 1024,
  warnBytes: Math.floor(920 * 1024 * 0.95),
};
