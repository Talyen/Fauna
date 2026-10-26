// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { startWebGLKeywordPlasma } from "../../../src/ui/shared/effects/rendering/keyword-plasma-webgl";
import type { PlasmaColorState } from "../../../src/ui/shared/effects/rendering/keyword-plasma-webgl";
import { animationHarness } from "../../support/animation-harness";

function createGl() {
  return {
    createShader: () => ({}),
    getShaderParameter: () => true,
    createProgram: () => ({}),
    getProgramParameter: () => true,
    createBuffer: () => ({}),
    getAttribLocation: () => 0,
    getUniformLocation: (_program: unknown, name: string) => name,
    ...Object.fromEntries(
      [
        "shaderSource",
        "compileShader",
        "deleteShader",
        "attachShader",
        "detachShader",
        "linkProgram",
        "bindBuffer",
        "bufferData",
        "enableVertexAttribArray",
        "vertexAttribPointer",
        "useProgram",
        "enable",
        "disable",
        "blendFunc",
        "clearColor",
        "clear",
      ].map((name) => [name, vi.fn()]),
    ),
    deleteBuffer: vi.fn(),
    deleteProgram: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    viewport: vi.fn(),
    drawArrays: vi.fn(),
  };
}

function setup(width = 640, height = 480) {
  const h = animationHarness(width, height);
  const gl = createGl();
  vi.mocked(h.canvas.getContext).mockReturnValue(gl as unknown as WebGLRenderingContext);
  const colorsRef: { current: PlasmaColorState } = { current: { primary: "#ffffff", secondary: "#000000" } };
  const options = { canvas: h.canvas, colorsRef, active: () => true };
  return { h, gl, colorsRef, options };
}

it("uploads sized uniforms and changing colors while preserving the bounded 30fps renderer", () => {
  const { h, gl, colorsRef, options } = setup(3840, 2160);
  vi.stubGlobal("devicePixelRatio", 2);
  const stop = startWebGLKeywordPlasma(options)!;
  h.own(stop);
  expect(h.canvas.width * h.canvas.height).toBeLessThanOrEqual(1_500_000);
  expect(gl.viewport).toHaveBeenCalledExactlyOnceWith(0, 0, h.canvas.width, h.canvas.height);
  expect(gl.uniform2f).toHaveBeenCalledWith("uSize", h.canvas.width, h.canvas.height);
  expect(gl.uniform2f).toHaveBeenLastCalledWith("uFocalCenter", h.canvas.width / 2, h.canvas.height / 2);
  h.frame(100);
  h.frame(110);
  h.frame(140);
  expect(gl.uniform1f).toHaveBeenLastCalledWith("uTime", 0.14);
  expect(gl.drawArrays).toHaveBeenCalledTimes(2);
  expect(gl.uniform3f).toHaveBeenCalledTimes(2);
  expect(gl.uniform3f).toHaveBeenCalledWith("uPrimary", 1, 1, 1);
  expect(gl.uniform3f).toHaveBeenCalledWith("uSecondary", 0, 0, 0);
  h.resize(800, 600);
  expect(gl.uniform2f).toHaveBeenLastCalledWith("uFocalCenter", h.canvas.width / 2, h.canvas.height / 2);
  const primary: [number, number, number] = [0.1, 0.2, 0.3];
  colorsRef.current.primary = primary;
  h.frame(180);
  expect(gl.uniform3f).toHaveBeenLastCalledWith("uPrimary", 0.1, 0.2, 0.3);
  primary[0] = 0.4;
  h.frame(220);
  expect(gl.uniform3f).toHaveBeenCalledTimes(4);
  expect(gl.uniform3f).toHaveBeenLastCalledWith("uPrimary", 0.4, 0.2, 0.3);
  const late = h.latestFrame;
  stop();
  late(260);
  expect(gl.drawArrays).toHaveBeenCalledTimes(4);
  expect(gl.deleteBuffer).toHaveBeenCalledOnce();
  expect(gl.deleteProgram).toHaveBeenCalledOnce();
});

it("releases GPU objects and frames when the wake adapter fails during setup and cleanup", () => {
  const { h, gl, options } = setup();
  expect(() =>
    startWebGLKeywordPlasma({
      ...options,
      onWakeReady: () => {
        throw new Error("wake failed");
      },
    }),
  ).toThrow();
  expect(gl.deleteBuffer).toHaveBeenCalledOnce();
  expect(gl.deleteProgram).toHaveBeenCalledOnce();
  expect(h.pending.size).toBe(0);
  h.latestFrame(100);
  window.dispatchEvent(new Event("focus"));
  expect(gl.drawArrays).not.toHaveBeenCalled();
  expect(h.raf).toHaveBeenCalledOnce();
});
