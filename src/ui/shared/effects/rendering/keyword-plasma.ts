import { attachWebGLContextLifecycle } from "./webgl-lifecycle";
import { startWebGLKeywordPlasma, type PlasmaRendererOptions } from "./keyword-plasma-webgl";

export function startKeywordPlasma(options: PlasmaRendererOptions): () => void {
  return attachWebGLContextLifecycle({
    canvas: options.canvas,
    start: () => startWebGLKeywordPlasma(options),
    onAvailabilityChange: options.onAvailabilityChange,
  });
}

export type { PlasmaColorState, PlasmaRendererOptions } from "./keyword-plasma-webgl";
