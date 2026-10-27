export function extractFoodRules(
  foodSource: string,
  cardRulesSource: string,
  abilitySource: string,
  keywordSource: string,
  boonSource: string,
): Record<string, { text: string; reference: string }>;
