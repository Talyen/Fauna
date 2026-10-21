// Reviewed UI and recovery rollout measured in hosted CI, October 21, 2026.
// See scripts/README.md for the artifact hash and allowance rationale.
export const BUNDLE_BUDGET = {
  baselineBytes: 670_024,
  maxBytes: 704 * 1024,
  warnBytes: Math.floor(704 * 1024 * 0.95),
};
