/** Inspect the bundled TrueType character map without relying on system fonts. */
export function fontHasGlyph(bytes, codePoint) {
  try {
    let cmap;
    for (let index = 0; index < bytes.readUInt16BE(4); index++) {
      const record = 12 + index * 16;
      if (bytes.toString("ascii", record, record + 4) === "cmap") cmap = bytes.readUInt32BE(record + 8);
    }
    if (cmap === undefined) return false;
    for (let index = 0; index < bytes.readUInt16BE(cmap + 2); index++) {
      const table = cmap + bytes.readUInt32BE(cmap + 8 + index * 8);
      const format = bytes.readUInt16BE(table);
      if (format === 12) {
        for (let group = 0; group < bytes.readUInt32BE(table + 12); group++) {
          const offset = table + 16 + group * 12;
          const start = bytes.readUInt32BE(offset);
          if (codePoint >= start && codePoint <= bytes.readUInt32BE(offset + 4))
            return bytes.readUInt32BE(offset + 8) + codePoint - start !== 0;
        }
      }
      if (format === 4 && codePoint <= 0xffff) {
        const count = bytes.readUInt16BE(table + 6) / 2;
        const ends = table + 14,
          starts = ends + count * 2 + 2,
          deltas = starts + count * 2,
          ranges = deltas + count * 2;
        for (let segment = 0; segment < count; segment++) {
          const start = bytes.readUInt16BE(starts + segment * 2);
          if (codePoint < start || codePoint > bytes.readUInt16BE(ends + segment * 2)) continue;
          const delta = bytes.readInt16BE(deltas + segment * 2),
            range = bytes.readUInt16BE(ranges + segment * 2);
          if (!range) return ((codePoint + delta) & 0xffff) !== 0;
          const glyph = bytes.readUInt16BE(ranges + segment * 2 + range + (codePoint - start) * 2);
          return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

const requirements = {
  ja: {
    file: "noto-sans-jp.ttf",
    pattern: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff00-\uffef]/gu,
  },
  "zh-Hans": { file: "noto-sans-sc.ttf", pattern: /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu },
  ru: { file: "noto-sans.ttf", pattern: /\p{Script=Cyrillic}/gu },
};

/** Qualification requires a bundled font covering the target catalog and native language label. */
export function qualifiedFontIssues(languages, catalogs, readFont) {
  const issues = [];
  for (const [locale, { file, pattern }] of Object.entries(requirements)) {
    if (!languages[locale]?.qualified) continue;
    const bytes = readFont(file);
    if (!bytes) {
      issues.push(`${locale}: missing bundled font ${file}`);
      continue;
    }
    const translated = Object.values(catalogs[locale] ?? {})
      .flatMap((entry) =>
        typeof entry?.text === "string" ? [entry.text] : Object.values(entry?.forms ?? {}),
      )
      .join("\n");
    const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
    const text =
      translated +
      (languages[locale]?.name ?? "") +
      Array.from({ length: 11 }, (_, index) => compact.format(10 ** (index + 5))).join("");
    const missing = [...new Set(text.match(pattern) ?? [])].filter(
      (character) => !fontHasGlyph(bytes, character.codePointAt(0)),
    );
    if (missing.length) issues.push(`${locale}: ${file} missing glyphs ${missing.join("")}`);
  }
  return issues;
}
