export interface PlasmaColorPair {
  primary: string;
  secondary: string;
}

export type RgbTuple = readonly [number, number, number];

const HEX_PATTERN = /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const WHITE: readonly [number, number, number] = [255, 255, 255];

export function parseHexRgbBytes(
  hex: string,
  fallback: readonly [number, number, number] = WHITE,
): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (!HEX_PATTERN.test(normalized)) return [...fallback];
  if (normalized.length === 3)
    return [
      Number.parseInt(normalized[0]!, 16) * 17,
      Number.parseInt(normalized[1]!, 16) * 17,
      Number.parseInt(normalized[2]!, 16) * 17,
    ];
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

const PLASMA_FALLBACK: readonly [number, number, number] = [0.8 * 255, 0.8 * 255, 0.8 * 255];
export function parsePlasmaHexColor(hex: string): [number, number, number] {
  const bytes = parseHexRgbBytes(hex, PLASMA_FALLBACK);
  return [bytes[0] / 255, bytes[1] / 255, bytes[2] / 255];
}
