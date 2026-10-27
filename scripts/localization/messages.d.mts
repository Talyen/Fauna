export function extractMessages(
  files: readonly { location: string; source: string }[],
): Record<string, unknown>;
export function extractProjectMessages(root: string): Record<string, unknown>;
