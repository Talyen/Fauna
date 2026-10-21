// Shared design-system rollout measured locally, October 20, 2026.
// See scripts/README.md for the artifact hash and allowance rationale.
export const BUNDLE_BUDGET = {
  baselineBytes: 613_638,
  maxBytes: 640 * 1024,
  warnBytes: Math.floor(640 * 1024 * 0.95),
};
