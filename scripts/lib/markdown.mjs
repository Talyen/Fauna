/** Matches a fenced-code-block delimiter (` ``` ` or ` ~~~ `, up to 3 spaces indent). */
const FENCE_MARKER_RE = /^ {0,3}(`{3,}|~{3,})/u;

/**
 * Length-aware fence tracker shared by every helper in this module. A fence
 * only closes on the same character with an equal or longer run, so a `~~~`
 * block is never closed by ` ``` ` and nested ```` ```` ```` blocks behave.
 * Returns the updated fence state (`null` when outside a fence).
 */
function trackFenceLine(line, fence) {
  const marker = FENCE_MARKER_RE.exec(line)?.[1];
  if (!marker) return fence;
  if (!fence) {
    // Backtick info strings cannot themselves contain backticks.
    if (marker[0] === "`" && line.slice(line.indexOf(marker) + marker.length).includes("`")) return null;
    return marker;
  }
  if (marker[0] === fence[0] && marker.length >= fence.length && /^ {0,3}(?:`{3,}|~{3,})[ \t]*$/u.test(line))
    return null;
  return fence;
}

function* unfencedLines(lines) {
  let fence = null;
  for (const [index, line] of lines.entries()) {
    const previous = fence;
    fence = trackFenceLine(line.replace(/\r$/u, ""), fence);
    if (!previous && !fence) yield { line, index };
  }
}

function escapedAt(source, index) {
  let escapes = 0;
  for (let before = index - 1; before >= 0 && source[before] === "\\"; before--) escapes++;
  return escapes % 2 !== 0;
}

export function extractMarkdownLinkTargets(source) {
  const targets = [];
  // Preserve offsets while masking code spans, including multi-backtick delimiters.
  const prose = source.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/gu, (span, _delimiter, index) =>
    escapedAt(source, index) ? span : " ".repeat(span.length),
  );
  for (const match of prose.matchAll(/\[[^\]\n]*\]\(/gu)) {
    if (escapedAt(source, match.index)) continue;
    let index = (match.index ?? 0) + match[0].length;
    const leading = /^[ \t]*(?:\r?\n[ \t]*)?/u.exec(source.slice(index));
    index += leading?.[0].length ?? 0;
    const enclosed = source[index] === "<";
    if (enclosed) index++;
    let target = "";
    let depth = 0;
    let closed = !enclosed;
    while (index < source.length) {
      const character = source[index];
      if (character === "\n" || character === "\r") break;
      if (character === "\\" && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/u.test(source[index + 1] ?? "")) {
        target += source[index + 1];
        index += 2;
        continue;
      }
      if (enclosed && character === ">") {
        index++;
        closed = true;
        break;
      }
      if (!enclosed) {
        if (character === "(") depth++;
        if (character === ")") {
          if (!depth) break;
          depth--;
        }
        if (/\s/u.test(character)) break;
      }
      target += character;
      index++;
    }
    if (!closed || depth || !target) continue;
    // A title, if present, must be quoted or parenthesized before the closing delimiter.
    if (
      !/^[ \t]*(?:\r?\n[ \t]*)?(?:(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))[ \t]*(?:\r?\n[ \t]*)?)?\)/u.test(
        source.slice(index),
      )
    )
      continue;
    targets.push({ target, index: match.index ?? 0 });
  }
  return targets;
}

function githubHeadingSlug(title) {
  return title
    .toLowerCase()
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/gu, "")
    .replaceAll(/\s/gu, "-");
}

function headingPlainText(raw) {
  return raw
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replaceAll(/\[([^\]]+)\]\[[^\]]*\]/gu, "$1")
    .replaceAll(/`([^`]+)`/gu, "$1")
    .replaceAll(/\*/gu, "")
    .replaceAll(/(^|[^\p{L}\p{N}_])(_{1,3})(\S(?:.*?\S)?)\2(?=$|[^\p{L}\p{N}_])/gu, "$1$3")
    .trim();
}

/** GitHub-style slugs for every heading outside fenced blocks, with `-N` dedup suffixes. */
export function headingSlugs(source) {
  const slugs = new Set();
  const seen = new Map();
  let paragraph = [];
  let previousIndex = -2;
  for (const { line, index } of unfencedLines(source.split("\n"))) {
    if (index !== previousIndex + 1) paragraph = [];
    previousIndex = index;
    const underline = /^ {0,3}(?:=+|-+)[ \t]*\r?$/u.test(line);
    const match = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/u.exec(line);
    const title = match?.[2] ?? (underline && paragraph.length ? paragraph.join(" ") : null);
    if (title === null) {
      if (underline) {
        paragraph = [];
        continue;
      }
      if (!line.trim() || /^(?: {4}|\t| {0,3}(?:>|[-+*] |\d+[.)] ))/u.test(line)) paragraph = [];
      else paragraph.push(line.trim());
      continue;
    }
    paragraph = [];
    const base = githubHeadingSlug(headingPlainText(title));
    if (!base) continue;
    let count = seen.get(base) ?? 0;
    let slug = count === 0 ? base : `${base}-${count}`;
    while (slugs.has(slug)) slug = `${base}-${++count}`;
    seen.set(base, count + 1);
    slugs.add(slug);
  }
  return slugs;
}

/** Source with fenced code blocks removed (backticked paths inside examples are not repo refs). */
export function stripFencedBlocks(source) {
  return Array.from(unfencedLines(source.split("\n")), ({ line }) => line).join("\n");
}
