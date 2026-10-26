import { createWebGLProgram } from "./webgl-program";
import { parsePlasmaHexColor, type RgbTuple } from "./plasma-colors";
import { createCanvasLifecycle, type CanvasLifecycle } from "./canvas-lifecycle";

type PlasmaColorValue = string | RgbTuple;

export interface PlasmaColorState {
  primary: PlasmaColorValue;
  secondary: PlasmaColorValue;
}

export interface PlasmaRendererOptions {
  canvas: HTMLCanvasElement;
  colorsRef: { current: PlasmaColorState };
  active: () => boolean;
  onAvailabilityChange?: ((available: boolean) => void) | undefined;
  onWakeReady?: ((wake: () => void) => void) | undefined;
}

const PLASMA_BACKING_OPTIONS = {
  maxPixels: 1_500_000,
  scaleMultiplier: 0.45,
  minScale: 0.25,
  maxScale: 0.75,
};

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 uSize;
uniform float uTime;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec2 uFocalCenter;

// Triangular-distribution dither: two uniform samples averaged remove banding
// while keeping the noise floor low (tent PDF vs harsh uniform).
float triDither(vec2 seed) {
  float r1 = fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453);
  float r2 = fract(sin(dot(seed + 0.5, vec2(93.9898, 67.345))) * 31415.9265);
  return (r1 + r2 - 1.0) / 255.0;
}

void main() {
  vec2 position = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  vec2 uv = (position - uFocalCenter) / min(uSize.x, uSize.y);
  float dist = length(uv);
  float ht = uTime;

  vec2 c1 = vec2(sin(ht * 0.30) * 0.60, cos(ht * 0.36) * 0.55);
  vec2 c2 = vec2(-c1.x, c1.y);
  vec2 c3 = vec2(cos(ht * 0.24 + 1.2) * 0.50, sin(ht * 0.32 + 0.8) * 0.45);
  vec2 c4 = vec2(-c3.x, c3.y);

  vec2 d1 = uv - c1;
  vec2 d2 = uv - c2;
  vec2 d3 = uv - c3;
  vec2 d4 = uv - c4;

  float f1 = 1.0 / (1.0 + dot(d1, d1) * 2.2);
  float f2 = 1.0 / (1.0 + dot(d2, d2) * 2.2);
  float f3 = 1.0 / (1.0 + dot(d3, d3) * 2.2);
  float f4 = 1.0 / (1.0 + dot(d4, d4) * 2.2);

  float field = (f1 + f2 + f3 + f4) * 0.25;
  float wave = cos(abs(uv.x) * 2.5 + ht * 0.12) * cos(uv.y * 2.0 - ht * 0.15) * 0.08;
  float fluid = clamp(field + wave, 0.0, 1.0);
  float smoothFluid = fluid * fluid * (3.0 - 2.0 * fluid);
  float radialFalloff = 1.0 / (1.0 + dist * dist * 1.4);

  vec3 color = mix(uPrimary, uSecondary, clamp(smoothFluid * 1.2, 0.0, 1.0));
  float alpha = clamp(smoothFluid * radialFalloff * 0.13 + triDither(position), 0.0, 0.14);

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

function tryGetWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  try {
    return canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
  } catch {
    return null;
  }
}

export function startWebGLKeywordPlasma(options: PlasmaRendererOptions): (() => void) | null {
  const { canvas, colorsRef, active, onWakeReady } = options;
  const gl = tryGetWebGLContext(canvas);
  if (!gl) return null;

  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let lifecycle: CanvasLifecycle | null = null;
  let released = false;
  const stop = () => {
    if (released) return;
    released = true;
    const failures: unknown[] = [];
    for (const cleanup of [
      () => onWakeReady?.(() => {}),
      () => lifecycle?.dispose(),
      () => {
        if (buffer) gl.deleteBuffer(buffer);
      },
      () => {
        if (program) gl.deleteProgram(program);
      },
    ]) {
      try {
        cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) throw new AggregateError(failures, "Plasma renderer cleanup failed");
  };
  let ready = false;
  try {
    program = createWebGLProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) return null;

    const positionLoc = gl.getAttribLocation(program, "aPosition");
    const sizeLoc = gl.getUniformLocation(program, "uSize");
    const timeLoc = gl.getUniformLocation(program, "uTime");
    const primaryLoc = gl.getUniformLocation(program, "uPrimary");
    const secondaryLoc = gl.getUniformLocation(program, "uSecondary");
    const focalLoc = gl.getUniformLocation(program, "uFocalCenter");

    buffer = gl.createBuffer();
    if (!buffer || positionLoc < 0 || !sizeLoc || !timeLoc || !primaryLoc || !secondaryLoc || !focalLoc) {
      return null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    // One fullscreen quad writes every pixel, including transparent ones. It
    // replaces the previous frame without a clear or destination blending.
    gl.disable(gl.BLEND);
    let cachedPrimarySource: string | RgbTuple | null = null;
    let cachedSecondarySource: string | RgbTuple | null = null;
    let cachedPrimary: RgbTuple = [0, 0, 0];
    let cachedSecondary: RgbTuple = [0, 0, 0];
    const uploadedPrimary: [number, number, number] = [NaN, NaN, NaN];
    const uploadedSecondary: [number, number, number] = [NaN, NaN, NaN];

    const uploadColor = (
      location: WebGLUniformLocation,
      color: RgbTuple,
      uploaded: [number, number, number],
    ): void => {
      if (color[0] === uploaded[0] && color[1] === uploaded[1] && color[2] === uploaded[2]) return;
      gl.uniform3f(location, color[0], color[1], color[2]);
      uploaded[0] = color[0];
      uploaded[1] = color[1];
      uploaded[2] = color[2];
    };

    const startTime = performance.now();
    lifecycle = createCanvasLifecycle({
      canvas,
      active,
      fpsLimit: 30,
      backingScale: PLASMA_BACKING_OPTIONS,
      onResize: () => {
        // These inputs depend only on the canvas size; WebGL retains them
        // between draws. Context restoration creates a fresh renderer.
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(sizeLoc, canvas.width, canvas.height);
        gl.uniform2f(focalLoc, canvas.width / 2, canvas.height / 2);
      },
      onFrame: (now, _dt, width, height) => {
        if (width <= 0 || height <= 0) return;

        if (cachedPrimarySource !== colorsRef.current.primary) {
          cachedPrimarySource = colorsRef.current.primary;
          cachedPrimary =
            typeof cachedPrimarySource === "string"
              ? parsePlasmaHexColor(cachedPrimarySource)
              : cachedPrimarySource;
        }
        if (cachedSecondarySource !== colorsRef.current.secondary) {
          cachedSecondarySource = colorsRef.current.secondary;
          cachedSecondary =
            typeof cachedSecondarySource === "string"
              ? parsePlasmaHexColor(cachedSecondarySource)
              : cachedSecondarySource;
        }
        const primary = cachedPrimary;
        const secondary = cachedSecondary;

        gl.uniform1f(timeLoc, (now - startTime) / 1000);
        // Uniforms survive draws and backing resizes. Compare channels so an
        // interpolated or in-place updated tuple still uploads its exact values.
        uploadColor(primaryLoc, primary, uploadedPrimary);
        uploadColor(secondaryLoc, secondary, uploadedSecondary);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    });
    onWakeReady?.(lifecycle.scheduleFrame);

    ready = true;
    return stop;
  } finally {
    // Until startup hands back its disposer, this function owns rollback.
    if (!ready) stop();
  }
}
