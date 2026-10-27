export function extractCardVariants(
  files: { location: string; source: string }[],
  sources: {
    cardRules: string;
    abilities: string;
    supplemental: string;
    contracts: string;
    abilityValues: string;
  },
  keywordSource: string,
): Record<string, { text: string; reference: string; contextHash: string }>;
