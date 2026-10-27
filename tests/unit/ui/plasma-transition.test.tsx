// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { KeywordPlasmaBackground } from "../../../src/ui/shared/effects/plasma-background";
import { startKeywordPlasma } from "../../../src/ui/shared/effects/rendering/keyword-plasma";

vi.mock("../../../src/ui/shared/effects/rendering/keyword-plasma", () => ({
  startKeywordPlasma: vi.fn(() => () => {}),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("keeps retargeted colors continuous and cancels an obsolete idle timer", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.spyOn(performance, "now").mockReturnValue(0);
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const draw = (now: number) => {
    const [id, callback] = frames.entries().next().value!;
    frames.delete(id);
    act(() => callback(now));
  };
  const view = render(
    <KeywordPlasmaBackground
      colorPair={{ primary: "#000000", secondary: "#000000" }}
      black="#000000"
      motionAllowed
    />,
  );
  const options = vi.mocked(startKeywordPlasma).mock.calls[0]![0];
  view.rerender(
    <KeywordPlasmaBackground
      colorPair={{ primary: "#ffffff", secondary: "#ffffff" }}
      black="#000000"
      motionAllowed
    />,
  );
  draw(100);
  const color = options.colorsRef.current.primary;
  if (typeof color === "string") throw new Error("Expected a color transition");
  const before = [...color];
  expect(before[0]).toBeGreaterThan(0);
  expect(before[0]).toBeLessThan(1);
  view.rerender(
    <KeywordPlasmaBackground
      colorPair={{ primary: "#ff0000", secondary: "#ff0000" }}
      black="#000000"
      motionAllowed
    />,
  );
  expect(frames.size).toBe(1);
  expect(options.colorsRef.current.primary).toEqual(before);
  draw(200);
  view.rerender(<KeywordPlasmaBackground colorPair={null} black="#000000" motionAllowed />);
  draw(5000);
  expect(options.active()).toBe(true);
  view.rerender(
    <KeywordPlasmaBackground
      colorPair={{ primary: "#ffffff", secondary: "#ffffff" }}
      black="#000000"
      motionAllowed
    />,
  );
  act(() => vi.advanceTimersByTime(100));
  expect(options.active()).toBe(true);
  view.unmount();
  expect(frames.size).toBe(0);
});
