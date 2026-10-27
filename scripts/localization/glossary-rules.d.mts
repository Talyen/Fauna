export function extractGlossaryRules(
  glossarySource: string,
  keywordSource: string,
  resurrectionSource: string,
): Record<string, { text: string; reference: string }>;
