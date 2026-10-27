export function sourceHash(locale: string, source: unknown, glossary: unknown): string;
export function validateCatalog(
  english: Record<string, unknown>,
  translations: Record<string, unknown>,
  locale: string,
  glossary: unknown,
  complete?: boolean,
): string[];
export function preparePackets(
  english: Record<string, unknown>,
  locales: readonly string[],
  catalogs: Record<string, Record<string, unknown>>,
  glossaries: Record<string, unknown>,
  previous?: unknown,
): unknown;
export function applyPackets(
  english: Record<string, unknown>,
  locales: readonly string[],
  catalogs: Record<string, Record<string, unknown>>,
  glossaries: Record<string, unknown>,
  packet: unknown,
): Record<string, Record<string, unknown>>;
export function qualificationIssues(
  languages: Record<string, { qualified: boolean }>,
  coverage: Record<string, boolean>,
  english: Record<string, unknown>,
  catalogs: Record<string, Record<string, unknown>>,
  glossaries: Record<string, unknown>,
): string[];
export function mergeSources(...catalogs: Record<string, unknown>[]): Record<string, unknown>;
