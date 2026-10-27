export function extractContent(
  files: readonly { location: string; source: string }[],
): Record<string, unknown>;
export function extractProjectContent(root: string): Record<string, unknown>;
