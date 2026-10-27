export function fontHasGlyph(bytes: Buffer, codePoint: number): boolean;
export function qualifiedFontIssues(
  languages: Record<string, { qualified: boolean; name?: string }>,
  catalogs: Record<string, Record<string, unknown>>,
  readFont: (file: string) => Buffer | null,
): string[];
