export function extractPassiveRules(
  files: { location: string; source: string }[],
  keywordSource: string,
): Record<string, { text: string; reference: string }>;
