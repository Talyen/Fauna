import type { CanvasBackingScaleOptions } from "./canvas-lifecycle";
import type { RgbTuple } from "./plasma-colors";

type PlasmaColorValue = string | RgbTuple;

export interface PlasmaColorState {
  primary: PlasmaColorValue;
  secondary: PlasmaColorValue;
}

export interface PlasmaRendererOptions {
  canvas: HTMLCanvasElement;
  colorsRef: { current: PlasmaColorState };
  focalYOffset: number;
  active: () => boolean;
  onAvailabilityChange?: ((available: boolean) => void) | undefined;
  onWakeReady?: ((wake: () => void) => void) | undefined;
}

export const PLASMA_BACKING_OPTIONS = {
  maxPixels: 1_500_000,
  scaleMultiplier: 0.45,
  minScale: 0.25,
  maxScale: 0.75,
} satisfies CanvasBackingScaleOptions;
