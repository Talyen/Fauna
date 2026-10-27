import { createHash } from "node:crypto";

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

/** Reject font inputs other than the pinned, licensed upstream source. */
export function verifiedFontSource(bytes, expectedHash) {
  return createHash("sha256").update(bytes).digest("hex") === expectedHash;
}

export const FONT_REQUIREMENTS = {
  ja: {
    file: "noto-sans-jp.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/a85815a42757630ce188fdad368c2dfc444d4773/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf",
    sha256: "c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f",
    pattern: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff00-\uffef]/gu,
  },
  "zh-Hans": {
    file: "noto-sans-sc.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/a85815a42757630ce188fdad368c2dfc444d4773/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
    sha256: "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da",
    pattern: /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu,
  },
  ru: {
    file: "noto-sans.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf",
    sha256: "bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d",
    pattern: /\p{Script=Cyrillic}/gu,
  },
};

/** Include player-facing catalog values, the language name and formatted compact numbers. */
export function requiredFontText(locale, languages, catalogs) {
  const translated = Object.values(catalogs[locale] ?? {})
    .flatMap((entry) => (typeof entry?.text === "string" ? [entry.text] : Object.values(entry?.forms ?? {})))
    .join("\n");
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  return (
    translated +
    (languages[locale]?.name ?? "") +
    Array.from({ length: 11 }, (_, index) => compact.format(10 ** (index + 5))).join("")
  );
}

/** Qualification requires a bundled font covering the target catalog and native language label. */
export function qualifiedFontIssues(languages, catalogs, readFont) {
  const issues = [];
  for (const [locale, { file, pattern }] of Object.entries(FONT_REQUIREMENTS)) {
    if (!languages[locale]?.qualified) continue;
    const bytes = readFont(file);
    if (!bytes) {
      issues.push(`${locale}: missing bundled font ${file}`);
      continue;
    }
    const text = requiredFontText(locale, languages, catalogs);
    const missing = [...new Set(text.match(pattern) ?? [])].filter(
      (character) => !fontHasGlyph(bytes, character.codePointAt(0)),
    );
    if (missing.length) issues.push(`${locale}: ${file} missing glyphs ${missing.join("")}`);
  }
  return issues;
}
