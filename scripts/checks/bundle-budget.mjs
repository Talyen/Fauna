// Reviewed combat and destination rollout measured in hosted CI, October 21, 2026.
// See scripts/README.md for the artifact hash and allowance rationale.
export const BUNDLE_BUDGET = {
  baselineBytes: 723_971,
  maxBytes: 760 * 1024,
  warnBytes: Math.floor(760 * 1024 * 0.95),
};
