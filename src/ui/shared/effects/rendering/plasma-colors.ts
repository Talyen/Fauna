export interface PlasmaColorPair {
  primary: string;
  secondary: string;
}

export type RgbTuple = readonly [number, number, number];

const HEX_PATTERN = /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHexRgbBytes(
  hex: string,
  fallback: readonly [number, number, number] = [255, 255, 255],
): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (!HEX_PATTERN.test(normalized)) return [...fallback];
  const expanded = normalized.length === 3 ? normalized.replace(/./g, "$&$&") : normalized;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
}

function parseHexRgbNormalized(
  hex: string,
  fallback: readonly [number, number, number] = [0.8, 0.8, 0.8],
): [number, number, number] {
  const bytes = parseHexRgbBytes(hex, [fallback[0] * 255, fallback[1] * 255, fallback[2] * 255]);
  return [bytes[0] / 255, bytes[1] / 255, bytes[2] / 255];
}

export function parsePlasmaHexColor(hex: string): [number, number, number] {
  return parseHexRgbNormalized(hex, [0.8, 0.8, 0.8]);
}
