// Stable-stack upgrade measured in hosted CI, October 21, 2026.
// See scripts/README.md for the artifact hash and allowance rationale.
export const BUNDLE_BUDGET = {
  baselineBytes: 774_677,
  maxBytes: 800 * 1024,
  warnBytes: Math.floor(800 * 1024 * 0.95),
};
