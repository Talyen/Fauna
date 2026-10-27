import { keywordText, type KeywordId, type KeywordTextPart } from "../../../game/keywords";
import { ruleTemplate } from "./rule-template.mjs";

/** One complete rule, with values and keyword identity retained separately from prose. */
export interface RuleMessage {
  source: string;
  template: string;
  values: Readonly<Record<string, string>>;
  keywords: Readonly<Record<string, KeywordId>>;
}

/**
 * This adapter preserves the existing English generator during migration. A catalog
 * must cover each resulting template, including different grammatical forms.
 */
export function ruleMessage(text: string): RuleMessage {
  return { source: text, ...ruleTemplate(keywordText(text)) };
}

/** Reject missing, duplicated or unknown placeholders and fall back to English. */
export function renderRuleMessage(message: RuleMessage, translation = message.template): KeywordTextPart[] {
  const parse = (template: string): KeywordTextPart[] | null => {
    const parts: KeywordTextPart[] = [];
    const seenValues = new Set<string>();
    const seenKeywords = new Set<string>();
    const token = /<(keyword\d+)>([^<>]*)<\/\1>|\{\{(value\d+)\}\}/g;
    let cursor = 0;
    const appendText = (text: string) => {
      if (/[<>]|\{\{|\}\}/.test(text)) return false;
      if (text) {
        const last = parts.at(-1);
        if (last && !last.keyword) parts[parts.length - 1] = { text: last.text + text };
        else parts.push({ text });
      }
      return true;
    };
    for (const match of template.matchAll(token)) {
      if (!appendText(template.slice(cursor, match.index))) return null;
      if (match[1]) {
        const id = message.keywords[match[1]];
        if (!id || seenKeywords.has(match[1]) || !match[2] || /\{\{|\}\}/.test(match[2])) return null;
        seenKeywords.add(match[1]);
        parts.push({ text: match[2], keyword: id });
      } else {
        const name = match[3]!;
        if (!Object.hasOwn(message.values, name) || seenValues.has(name)) return null;
        seenValues.add(name);
        appendText(message.values[name]!);
      }
      cursor = match.index + match[0].length;
    }
    if (!appendText(template.slice(cursor))) return null;
    if (
      seenValues.size !== Object.keys(message.values).length ||
      seenKeywords.size !== Object.keys(message.keywords).length
    )
      return null;
    return parts;
  };
  return parse(translation) ?? parse(message.template) ?? keywordText(message.source);
}
