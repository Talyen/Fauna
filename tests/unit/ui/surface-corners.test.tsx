// @vitest-environment jsdom
import { StrictMode, createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Button } from "../../../src/components/ui/button";
import { ArtCard } from "../../../src/ui/shared/cards/art-card";

const observers: { resize: (width: number, height: number) => void; disconnect: ReturnType<typeof vi.fn> }[] =
  [];
function measurements() {
  const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(200);
  const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(100);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      constructor(callback: ResizeObserverCallback) {
        observers.push({
          disconnect: this.disconnect,
          resize: (width, height) =>
            callback(
              [
                {
                  borderBoxSize: [{ inlineSize: width, blockSize: height }],
                } as unknown as ResizeObserverEntry,
              ],
              this as unknown as ResizeObserver,
            ),
        });
      }
      observe() {}
    },
  );
  return { width, height };
}
afterEach(() => {
  cleanup();
  observers.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("sizes artwork from its untransformed shorter side and follows layout resizing", () => {
  const { width, height } = measurements();
  const ref = createRef<HTMLButtonElement>();
  const view = render(<ArtCard ref={ref} artwork="/art.webp" aspect="creature" aria-label="Creature" />);
  const card = view.getByRole("button", { name: "Creature" });
  expect(ref.current).toBe(card);
  expect(width).not.toHaveBeenCalled();
  expect(height).not.toHaveBeenCalled();
  observers[0]!.resize(200, 100);
  expect(card.style.getPropertyValue("--surface-short-side")).toBe("100px");
  // Border-box measurements exclude the hover scale; flipping aspect preserves the radius.
  observers[0]!.resize(100, 200);
  expect(card.style.getPropertyValue("--surface-short-side")).toBe("100px");
  observers[0]!.resize(160, 240);
  expect(card.style.getPropertyValue("--surface-short-side")).toBe("160px");
  observers[0]!.resize(0, 0);
  expect(card.style.getPropertyValue("--surface-short-side")).toBe("160px");
  view.unmount();
  expect(ref.current).toBeNull();
  expect(observers[0]!.disconnect).toHaveBeenCalledOnce();
  observers[0]!.resize(900, 900);
  expect(card.style.getPropertyValue("--surface-short-side")).toBe("");
});

it("releases callback refs and old observers across Strict Mode and ref replacement", () => {
  measurements();
  const release = vi.fn();
  const first = vi.fn(() => release);
  const second = createRef<HTMLButtonElement>();
  const view = render(
    <StrictMode>
      <Button ref={first}>Continue</Button>
    </StrictMode>,
  );
  const old = observers.at(-1)!;
  const card = view.getByRole("button");
  view.rerender(
    <StrictMode>
      <Button ref={second}>Continue</Button>
    </StrictMode>,
  );
  expect(release.mock.calls.length).toBe(first.mock.calls.length);
  expect(old.disconnect).toHaveBeenCalledOnce();
  expect(second.current).toBe(card);
  old.resize(1, 1);
  expect(card.style.getPropertyValue("--surface-short-side")).toBe("");
  observers.at(-1)!.resize(200, 100);
  expect(card.style.getPropertyValue("--surface-short-side")).toBe("100px");
  view.unmount();
  expect(second.current).toBeNull();
});

it("measures presentation artwork without adding a control or requiring ResizeObserver", () => {
  vi.stubGlobal("ResizeObserver", undefined);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(160);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(120);
  const view = render(<ArtCard presentation artwork="/art.webp" aspect="creature" aria-label="Creature" />);
  expect(view.queryByRole("button")).toBeNull();
  expect(view.getByRole("img").style.getPropertyValue("--surface-short-side")).toBe("120px");
});
