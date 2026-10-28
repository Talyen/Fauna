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
  // Mask inline code without shifting offsets used to parse link destinations.
  const masked = source.split("");
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "`") continue;
    if (escapedAt(source, i)) continue;
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
  const openings = [];
  const candidates = [];
  for (let index = 0; index < masked.length; index++) {
    if ((masked[index] !== "[" && masked[index] !== "]") || escapedAt(source, index)) continue;
    if (masked[index] === "[") openings.push(index);
    else if (masked[index] === "]" && openings.length) {
      const start = openings.pop();
      if (masked[index + 1] === "(")
        candidates.push({
          start,
          destination: index + 2,
          image: source[start - 1] === "!" && !escapedAt(source, start - 1),
        });
    }
  }
  let lastLinkStart = -1;
  for (const candidate of candidates) {
    if (/\r?\n[ \t]*\r?\n/u.test(source.slice(candidate.start, candidate.destination))) continue;
    // An image may appear inside a link, but another link cannot.
    if (!candidate.image && lastLinkStart > candidate.start && lastLinkStart < candidate.destination)
      continue;
    let index = candidate.destination;
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
      if (enclosed && character === "<") break;
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
    // A title needs whitespace after the destination, including an angle-enclosed one.
    if (source[index] !== ")" && !/[ \t\r\n]/u.test(source[index] ?? "")) continue;
    // A title, if present, must be quoted or parenthesized before the closing delimiter.
    if (
      !/^[ \t]*(?:\r?\n[ \t]*)?(?:(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))[ \t]*(?:\r?\n[ \t]*)?)?\)/u.test(
        source.slice(index),
      )
    )
      continue;
    targets.push({ target, index: candidate.start });
    if (!candidate.image) lastLinkStart = candidate.start;
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
    if (/^ {0,3}#{1,6}[ \t]*\r?$/u.test(line)) {
      paragraph = [];
      continue;
    }
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
