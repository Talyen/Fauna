// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { connectInput, moveFocus, type InputAction } from "../../../src/ui/shared/navigation/input";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("leaves horizontal tabs for the next settings row while preserving native widget arrows", () => {
  const root = document.createElement("div");
  root.dataset.navLayout = "rows";
  root.innerHTML = `<div data-nav-row role="tablist" aria-orientation="horizontal"><button role="tab">Sound</button></div>
    <div data-nav-row><span id="master" role="slider" tabindex="0"></span></div>`;
  document.body.append(root);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const actions = vi.fn((action: InputAction) => {
    if (action === "down") moveFocus(action);
  });
  const close = connectInput(actions, () => {});
  try {
    const tab = root.querySelector<HTMLButtonElement>("button")!;
    tab.focus();
    const right = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    tab.dispatchEvent(right);
    expect(right.defaultPrevented).toBe(false);
    expect(actions).not.toHaveBeenCalled();
    tab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement?.id).toBe("master");
    const down = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(actions).toHaveBeenCalledTimes(1);
  } finally {
    close();
    root.remove();
  }
});
it.each(["Enter", " "])("enables navigation for %s activation of a focused control", (key) => {
  const button = document.createElement("button");
  document.body.append(button);
  const modes = vi.fn();
  const close = connectInput(() => {}, modes);
  try {
    button.focus();
    button.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    expect(modes).toHaveBeenLastCalledWith("keyboard", true);
  } finally {
    close();
    button.remove();
  }
});
it("leaves opening arrows to a focused closed dropdown", () => {
  const trigger = document.createElement("button");
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-expanded", "false");
  document.body.append(trigger);
  const actions = vi.fn();
  const modes = vi.fn();
  const close = connectInput(actions, modes);
  try {
    trigger.focus();
    for (const key of ["ArrowUp", "ArrowDown"]) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      trigger.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(trigger);
      expect(modes).toHaveBeenLastCalledWith("keyboard", true);
    }
    expect(actions).not.toHaveBeenCalled();
  } finally {
    close();
    trigger.remove();
  }
});
it.each(["ArrowDown", "Home", "End", "Enter", " "])(
  "tracks %s navigation inside a native dropdown without routing its keys",
  (key) => {
    const content = document.createElement("div");
    content.setAttribute("data-radix-select-content", "");
    content.innerHTML = '<div role="option" tabindex="-1">English</div>';
    document.body.append(content);
    const actions = vi.fn();
    const modes = vi.fn();
    const close = connectInput(actions, modes);
    try {
      const option = content.firstElementChild as HTMLElement;
      option.focus();
      window.dispatchEvent(new Event("pointermove"));
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      option.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(actions).not.toHaveBeenCalled();
      expect(modes).toHaveBeenLastCalledWith("keyboard", true);
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      option.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(option);
      expect(actions).not.toHaveBeenCalled();
    } finally {
      close();
      content.remove();
    }
  },
);
it("leaves Escape to an open native dialog without blurring its focused control", () => {
  const dialog = document.createElement("div");
  dialog.dataset.nativeEscape = "";
  dialog.dataset.state = "open";
  dialog.innerHTML = "<button>Cancel</button>";
  document.body.append(dialog);
  const actions = vi.fn();
  const close = connectInput(actions, () => {});
  const button = dialog.querySelector("button")!;
  try {
    button.focus();
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    expect(actions).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(button);
    dialog.dataset.state = "closed";
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(actions).toHaveBeenCalledWith("back");
  } finally {
    close();
    dialog.remove();
  }
});
it("retains the focused opener while routing Back so menus can restore it", () => {
  const opener = document.createElement("button");
  document.body.append(opener);
  const focused: Element[] = [];
  const modes = vi.fn();
  const close = connectInput(() => focused.push(document.activeElement!), modes);
  try {
    opener.focus();
    opener.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(focused).toEqual([opener]);
    expect(document.activeElement).toBe(opener);
    expect(modes).toHaveBeenLastCalledWith("keyboard", false);
  } finally {
    close();
    opener.remove();
  }
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

it("keeps input in an open dialog when background controls are focused", () => {
  const root = document.createElement("div");
  root.innerHTML =
    '<button id="background">Background</button><div role="dialog" data-state="open"><button>Close</button></div>';
  document.body.append(root);
  const background = root.querySelector<HTMLButtonElement>("#background")!;
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  try {
    background.focus();
    moveFocus("down");
    expect(document.activeElement).toBe(root.querySelector('[role="dialog"] button'));
  } finally {
    root.remove();
  }
});

it("F7 returns to the tab stop without focusing inactive tabs or radios", () => {
  const root = document.createElement("div");
  root.innerHTML = `<div role="tablist"><button id="display" tabindex="0">Display</button>
    <button tabindex="-1">Other</button></div><div role="tabpanel" tabindex="0"></div>
    <div role="radiogroup"><button id="selected" tabindex="0">Selected</button>
    <button tabindex="-1">Unselected</button></div><button id="next">Next</button>`;
  document.body.append(root);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const actions = vi.fn();
  const close = connectInput(actions, () => {});
  try {
    root.querySelector<HTMLElement>('[role="tabpanel"]')!.focus();
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "F7", bubbles: true }));
    expect(document.activeElement?.id).toBe("display");
    root.querySelector<HTMLElement>("#next")!.focus();
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "F7", bubbles: true }));
    expect(document.activeElement?.id).toBe("selected");
    expect(actions).not.toHaveBeenCalled();
  } finally {
    close();
    root.remove();
  }
});

it("F7 starts at the last available control when focus is outside the tab order", () => {
  const root = document.createElement("div");
  root.innerHTML =
    '<button>First</button><button id="last">Last</button><button disabled>Unavailable</button>';
  document.body.append(root);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  const close = connectInput(
    () => {},
    () => {},
  );
  try {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F7" }));
    expect(document.activeElement?.id).toBe("last");
  } finally {
    close();
    root.remove();
  }
});
