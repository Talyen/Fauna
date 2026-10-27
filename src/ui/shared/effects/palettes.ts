import { keywordText, KEYWORD_IDS, isKeywordId, type KeywordId } from "../../../game/keywords";
import { speciesCards, type SpeciesId } from "../../../game/content";
import { cardText } from "../../../game/card-rules";
import { creaturePassive } from "../../../game/progression";
import type { GameState } from "../../../game/types";
import { parseHexRgbBytes, type PlasmaColorPair } from "./rendering/plasma-colors";

export type EffectTone = "gold" | "death" | "play" | "talents" | "settings";
export interface EffectPalette {
  keywords: readonly KeywordId[];
  border: readonly string[];
  text: readonly string[];
  plasma: PlasmaColorPair;
}

export function visualKeywords(text: string): KeywordId[] {
  const keywords = new Set<KeywordId>();
  for (const part of keywordText(text)) if (part.keyword) keywords.add(part.keyword);
  return [...keywords];
}

export function creatureKeywords(kind: SpeciesId, progression?: Pick<GameState, "discovery">): KeywordId[] {
  return visualKeywords(
    [
      creaturePassive(progression, kind).description,
      ...speciesCards(kind).map((card) => cardText(card)),
    ].join("; "),
  );
}

/** CSS owns paint values; only the canvas boundary needs numeric colors. */
export function readEffectTokens() {
  const style = getComputedStyle(document.documentElement);
  const color = (name: string, raw = style.getPropertyValue(name).trim()) => {
    if (/^#[\da-f]{3,6}$/i.test(raw)) return raw;
    const mix = raw.match(/^color-mix\(in srgb,\s*(#[\da-f]+)\s+([\d.]+)%,\s*(#[\da-f]+)\s*\)$/i);
    if (mix) {
      const from = parseHexRgbBytes(mix[1]!);
      const to = parseHexRgbBytes(mix[3]!);
      const weight = Number(mix[2]) / 100;
      return `#${from
        .map((value, index) =>
          Math.round(value * weight + to[index]! * (1 - weight))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`;
    }
    return style.getPropertyValue("--keyword-physical").trim();
  };
  const tokens: Record<string, string> = {};
  for (const id of KEYWORD_IDS) {
    tokens[`keyword-${id}`] = color(`--keyword-${id}`);
    tokens[`keyword-${id}-deep`] = color(`--keyword-${id}-deep`);
  }
  for (const name of ["gold", "death", "play", "talents", "settings", "embers", "battle", "campfire"])
    for (const stop of ["primary", "deep", "secondary"]) {
      const property = `--effect-${name}-${stop}`;
      const raw = style.getPropertyValue(property).trim();
      if (raw) tokens[`effect-${name}-${stop}`] = color(property, raw);
    }
  tokens.highlight = color("--effect-highlight");
  tokens.black = color("--effect-black");
  return tokens;
}

export function effectPalette(ids: readonly KeywordId[] = [], tone?: EffectTone): EffectPalette {
  const unique = new Set<KeywordId>();
  for (const id of ids) if (isKeywordId(id)) unique.add(id);
  const keywords = [...unique];
  const resolved = keywords.length ? keywords : ["physical" as const];
  const primary = tone ? `var(--effect-${tone}-primary)` : `var(--keyword-${resolved[0]})`;
  const secondary = tone
    ? `var(--effect-${tone}-deep)`
    : resolved[1]
      ? `var(--keyword-${resolved[1]})`
      : `var(--keyword-${resolved[0]}-deep)`;
  const accents = tone ? [primary, secondary] : resolved.map((id) => `var(--keyword-${id})`);
  return {
    keywords,
    border: tone || resolved.length === 1 ? [primary, secondary, primary] : [...accents, accents[0]!],
    text: accents.slice(0, 3).flatMap((color) => [color, `color-mix(in srgb, ${color} 55%, transparent)`]),
    plasma: { primary, secondary },
  };
}

export function resolveEffectColor(color: string, tokens: Record<string, string>) {
  return color.replace(
    /var\(--([\w-]+)\)/g,
    (_, name: string) => tokens[name] ?? tokens["keyword-physical"]!,
  );
}
