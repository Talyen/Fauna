export function extractBoonRules(
  ruleSource: string,
  keywordSource: string,
): Record<string, { text: string; reference: string }>;

export function keywordPattern(source: string): RegExp;
export function templateFor(text: string, pattern: RegExp): string;
