// @vitest-environment jsdom
import { useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBattleArtworkSize } from "../../../src/ui/battle/use-battle-artwork-size";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("settles height-constrained artwork instead of alternating sizes as observers fire", () => {
  let resized = () => {};
  let frame: FrameRequestCallback = () => {};
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1280);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(720);
  const height = (node: HTMLElement) =>
    ((parseFloat(node.closest<HTMLElement>("main")!.style.getPropertyValue("--battle-fitted-width")) || 214) *
      3) /
    4;
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return Math.round(height(this));
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return {
      top: this.matches(".hand-section") ? 469.75 : 0,
      bottom: 720,
      height: this.matches(".enemy-row, .player-row") ? height(this) + 68 : 720,
    } as DOMRect;
  });
  vi.stubGlobal("getComputedStyle", (node: HTMLElement) => ({
    rowGap: "12px",
    columnGap: "12px",
    paddingLeft: "0px",
    paddingRight: "0px",
    paddingBottom: "0px",
    minWidth: "100px",
    height: node.matches(".creature-card") ? `${height(node)}px` : "720px",
    getPropertyValue: (token: string) => (token === "--control-height" ? "44px" : "0px"),
  }));
  function Board() {
    const root = useRef<HTMLElement>(null);
    useBattleArtworkSize(root);
    return (
      <main ref={root}>
        <div className="enemy-row">
          <div className="creature-card" />
        </div>
        <div className="player-row" />
        <div className="target-control" />
        <div className="hand-section" />
      </main>
    );
  }
  const view = render(<Board />);
  const board = view.container.querySelector("main")!;
  const sizes = [board.style.getPropertyValue("--battle-fitted-width")];
  for (let i = 0; i < 8; i++) {
    act(() => {
      resized();
      frame(i * 16);
    });
    sizes.push(board.style.getPropertyValue("--battle-fitted-width"));
  }
  expect(new Set(sizes)).toEqual(new Set(["214px"]));
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
