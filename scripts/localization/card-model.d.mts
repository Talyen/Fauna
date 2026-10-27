export function readCardDescriptionFunctions(source: string): Record<string, unknown>;
export function describeCardRule(fn: unknown, args: unknown[], labels: Record<string, string>): string;
export function readAuthoredCards(
  files: { location: string; source: string }[],
): Record<string, Record<string, unknown>>;
export function readSupplementalPolicies(source: string): Record<string, { scaling: string; enemy: boolean }>;
export function describeCompleteCard(
  card: unknown,
  level: number,
  value: number,
  power: number,
  sources: { cardRules: string; abilities: string; supplemental: string },
  labels: Record<string, string>,
): string;
export function readAbilityAdaptations(source: string): Record<string, string>;
export function enemyCardModel(
  card: Record<string, unknown>,
  abilitiesSource: string,
  supplementalSource: string,
): Record<string, unknown>;
export function readKeywordLabels(source: string): Record<string, string>;
