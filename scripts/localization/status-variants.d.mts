export function extractStatusVariants(
  statusSource: string,
  glossarySource: string,
  keywordSource: string,
  resurrectionSource: string,
): Record<string, { text: string; reference: string; contextHash: string }>;
