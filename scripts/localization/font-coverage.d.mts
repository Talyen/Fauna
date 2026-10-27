export function verifiedFontSource(bytes: Buffer, expectedHash: string): boolean;
export function fontHasGlyph(bytes: Buffer, codePoint: number): boolean;
export function qualifiedFontIssues(
  languages: Record<string, { qualified: boolean; name?: string }>,
  catalogs: Record<string, Record<string, unknown>>,
  readFont: (file: string) => Buffer | null,
): string[];

export const FONT_REQUIREMENTS: Record<
  string,
  { file: string; url: string; sha256: string; pattern: RegExp }
>;
export function requiredFontText(
  locale: string,
  languages: Record<string, { name?: string }>,
  catalogs: Record<string, Record<string, unknown>>,
): string;
