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
  if (!fence) return marker;
  if (marker[0] === fence[0] && marker.length >= fence.length && /^ {0,3}(?:`{3,}|~{3,})[ \t]*$/u.test(line))
    return null;
  return fence;
}

function* unfencedLines(lines) {
  let fence = null;
  for (const [index, line] of lines.entries()) {
    fence = trackFenceLine(line.replace(/\r$/u, ""), fence);
    if (!FENCE_MARKER_RE.test(line) && !fence) yield { line, index };
  }
}

export function extractMarkdownLinkTargets(source) {
  const targets = [];
  // Mask inline code without shifting offsets used to parse link destinations.
  const masked = source.split("");
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "`") continue;
    let escapes = 0;
    for (let j = i - 1; j >= 0 && source[j] === "\\"; j--) escapes++;
    if (escapes % 2) continue;
    let end = i;
    while (source[end] === "`") end++;
    const marker = source.slice(i, end);
    let close = end;
    while ((close = source.indexOf(marker, close)) !== -1) {
      if (source[close - 1] !== "`" && source[close + marker.length] !== "`") break;
      close += marker.length;
    }
    if (close < 0) {
      i = end - 1;
      continue;
    }
    for (let j = i; j < close + marker.length; j++) masked[j] = " ";
    i = close + marker.length - 1;
  }
  for (const match of masked.join("").matchAll(/\[[^\]\n]*\]\(/gu)) {
    let escapes = 0;
    for (let i = match.index - 1; i >= 0 && source[i] === "\\"; i--) escapes++;
    if (escapes % 2) continue;
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
  for (const { line } of unfencedLines(source.split("\n"))) {
    const match = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/u.exec(line);
    if (!match?.[2]) continue;
    const base = githubHeadingSlug(headingPlainText(match[2]));
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
