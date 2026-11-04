// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { connectInput, moveFocus, type InputAction } from "../../../src/ui/shared/navigation/input";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("uses keyboard events for Steam Input and ignores native controller polling", () => {
  const gamepads = vi.fn();
  vi.stubGlobal("navigator", { getGamepads: gamepads });
  const actions: InputAction[] = [];
  const modes = vi.fn();
  const close = connectInput((action) => actions.push(action), modes);
  for (const key of ["ArrowRight", "a", "Escape", "Escape"])
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        repeat: key === "Escape" && actions.includes("back"),
        bubbles: true,
      }),
    );
  expect(actions).toEqual(["right", "back"]);
  expect(gamepads).not.toHaveBeenCalled();
  close();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  expect(actions).toHaveLength(2);
});
it("revokes background input and does not enable focus with confirm alone", () => {
  const actions = vi.fn(),
    modes = vi.fn();
  const close = connectInput(actions, modes);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  expect(modes).toHaveBeenLastCalledWith("keyboard", false);
  window.dispatchEvent(new Event("blur"));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(actions).not.toHaveBeenCalled();
  window.dispatchEvent(new Event("focus"));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
  expect(actions).toHaveBeenCalledWith("right");
  close();
});
it("moves through settings rows without skipping the offset Sound switch", () => {
  const root = document.createElement("div");
  root.dataset.navLayout = "rows";
  root.innerHTML = `<section data-nav-row><button id="diagnostic">Diagnostics</button></section>
    <label data-nav-row><button id="sound" role="switch">Sound</button></label>
    <div data-nav-row><button id="less">Decrease</button><button id="more">Increase</button></div>`;
  document.body.append(root);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const positions: Record<string, [number, number, number]> = {
      diagnostic: [0, 0, 200],
      sound: [300, 60, 44],
      less: [180, 120, 44],
      more: [300, 120, 44],
    };
    const [x, y, width] = positions[this.id] ?? [0, 0, 0];
    return { x, y, width, height: 44 } as DOMRect;
  });
  try {
    root.querySelector<HTMLButtonElement>("#diagnostic")!.focus();
    moveFocus("down");
    expect(document.activeElement?.id).toBe("sound");
    moveFocus("down");
    expect(document.activeElement?.id).toBe("more");
    moveFocus("left");
    expect(document.activeElement?.id).toBe("less");
    moveFocus("up");
    expect(document.activeElement?.id).toBe("sound");
  } finally {
    root.remove();
  }
});

it("moves vertically from switches through slider rows without changing their values", () => {
  const root = document.createElement("div");
  root.dataset.navLayout = "rows";
  root.innerHTML = `<div data-nav-row><button id="sound" role="switch">Sound</button></div>
    <div data-nav-row><span id="master" role="slider" tabindex="0" aria-orientation="horizontal"></span></div>
    <div data-nav-row><span id="music" role="slider" tabindex="0" aria-orientation="horizontal"></span></div>`;
  document.body.append(root);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const events = vi.fn();
  root.addEventListener("keydown", events);
  try {
    root.querySelector<HTMLElement>("#sound")!.focus();
    moveFocus("down");
    expect(document.activeElement?.id).toBe("master");
    moveFocus("down");
    expect(document.activeElement?.id).toBe("music");
    moveFocus("up");
    expect(document.activeElement?.id).toBe("master");
    expect(events).not.toHaveBeenCalled();
    moveFocus("left");
    expect(events.mock.calls[0]![0].key).toBe("ArrowLeft");
    expect(document.activeElement?.id).toBe("master");
  } finally {
    root.remove();
  }
});

it("keeps inspection actions reachable across a long passive list", () => {
  const root = document.createElement("div");
  root.dataset.navLayout = "rows";
  root.setAttribute("role", "dialog");
  root.dataset.state = "open";
  root.innerHTML = `<header data-nav-row><button id="back">Back</button></header>
    <button id="creature">Creature details</button>
    <section>Long passive tier list</section>
    <div data-nav-row><button id="attack">Attack</button><button id="guard">Guard</button></div>`;
  document.body.append(root);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const positions: Record<string, [number, number]> = {
      back: [0, 0],
      creature: [300, 100],
      attack: [0, 1200],
      guard: [300, 1200],
    };
    const [x, y] = positions[this.id] ?? [0, 0];
    return { x, y, width: 44, height: 44 } as DOMRect;
  });
  try {
    root.querySelector<HTMLButtonElement>("#back")!.focus();
    moveFocus("down");
    expect(document.activeElement?.id).toBe("attack");
    moveFocus("right");
    expect(document.activeElement?.id).toBe("guard");
    moveFocus("up");
    expect(document.activeElement?.id).toBe("back");
  } finally {
    root.remove();
  }
});

it("skips mounted inactive settings panels during vertical navigation", () => {
  const root = document.createElement("div");
  root.dataset.navLayout = "rows";
  root.innerHTML = `<div data-nav-row><button id="category">Sound category</button></div>
    <section inert aria-hidden="true"><div data-nav-row><button id="inactive">Text size</button></div></section>
    <div data-nav-row><button id="active">Sound</button></div>`;
  document.body.append(root);
  // Inactive panels reserve their layout space, so their rows still have rectangles.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  try {
    root.querySelector<HTMLButtonElement>("#category")!.focus();
    moveFocus("down");
    expect(document.activeElement?.id).toBe("active");
    moveFocus("up");
    expect(document.activeElement?.id).toBe("category");
  } finally {
    root.remove();
  }
});

it("scrolls a focused reading region with controller navigation and leaves it at the top boundary", () => {
  const root = document.createElement("div");
  root.innerHTML = '<button id="back">Back</button><div data-scroll-region tabindex="0"></div>';
  document.body.append(root);
  const region = root.querySelector<HTMLElement>("[data-scroll-region]")!;
  Object.defineProperties(region, { clientHeight: { value: 200 }, scrollHeight: { value: 800 } });
  region.scrollTop = 100;
  region.scrollBy = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { x: 0, y: this === region ? 100 : 0, width: 100, height: 44 } as DOMRect;
  });
  try {
    region.focus();
    moveFocus("down");
    expect(region.scrollBy).toHaveBeenCalledWith({ top: 150, behavior: "instant" });
    expect(document.activeElement).toBe(region);
    moveFocus("up");
    expect(region.scrollBy).toHaveBeenLastCalledWith({ top: -150, behavior: "instant" });
    region.scrollTop = 0;
    moveFocus("up");
    expect(document.activeElement?.id).toBe("back");
  } finally {
    root.remove();
  }
});

it("keeps an open dialog's input scope ahead of background reading-region scrolling", () => {
  const root = document.createElement("div");
  root.innerHTML =
    '<div data-scroll-region tabindex="0"></div><div role="dialog" data-state="open"><button>Close</button></div>';
  document.body.append(root);
  const region = root.querySelector<HTMLElement>("[data-scroll-region]")!;
  Object.defineProperties(region, { clientHeight: { value: 200 }, scrollHeight: { value: 800 } });
  region.scrollBy = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  try {
    region.focus();
    moveFocus("down");
    expect(region.scrollBy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(root.querySelector("button"));
  } finally {
    root.remove();
  }
});
