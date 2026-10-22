// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectInput, gamepadActions, moveFocus, type InputAction } from "../../../src/ui/shared/input";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function harness(onAction?: (action: InputAction) => void, suspended = () => false) {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  let frame: FrameRequestCallback = () => {};
  let pads: Array<Pick<Gamepad, "mapping" | "buttons" | "axes"> | null> = [];
  vi.stubGlobal("navigator", { getGamepads: () => pads });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const actions: InputAction[] = [];
  const modes = vi.fn();
  const dispose = connectInput(
    (action) => {
      actions.push(action);
      onAction?.(action);
    },
    modes,
    suspended,
  );
  const tick = (now: number, buttons: number[] = [], axes = [0, 0]) => {
    pads = [
      {
        mapping: "standard",
        buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i) }) as GamepadButton),
        axes,
      },
    ];
    frame(now);
  };
  tick(0);
  return {
    actions,
    modes,
    tick,
    dispose,
    disconnect: (now: number) => {
      pads = [];
      frame(now);
    },
  };
}

describe("player input ownership", () => {
  it("revokes the rest of a controller sample when an action suspends input", () => {
    let suspended = false;
    const h = harness(
      () => {
        suspended = true;
      },
      () => suspended,
    );
    try {
      h.tick(10, [0, 1, 13]);
      expect(h.actions).toEqual(["confirm"]);
      h.tick(20, [0, 1, 13]);
      suspended = false;
      h.tick(30, [0, 1, 13]);
      expect(h.actions).toEqual(["confirm"]);
      h.tick(40);
      h.tick(50, [1]);
      expect(h.actions).toEqual(["confirm", "back"]);
    } finally {
      h.dispose();
    }
  });
  it("does not unwind multiple menu levels when Escape or inspect is held", () => {
    const h = harness();
    try {
      for (const key of ["Escape", "i"]) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent("keydown", { key, repeat: true, bubbles: true }));
      }
      expect(h.actions).toEqual(["back", "inspect"]);
    } finally {
      h.dispose();
    }
  });
  it("lets pointer interaction reclaim input from a held stick until it is released", () => {
    const h = harness();
    try {
      h.tick(10, [], [1, 0]);
      window.dispatchEvent(new Event("pointerdown"));
      h.tick(500, [], [1, 0]);
      expect(h.actions).toEqual(["right"]);
      h.tick(510);
      h.tick(520, [], [1, 0]);
      expect(h.actions).toEqual(["right", "right"]);
    } finally {
      h.dispose();
    }
  });
  it("suspends controller actions in the background and requires release on return", () => {
    const h = harness();
    try {
      window.dispatchEvent(new Event("blur"));
      h.tick(10, [0]);
      window.dispatchEvent(new Event("focus"));
      h.tick(20, [0]);
      expect(h.actions).toEqual([]);
      h.tick(30);
      h.tick(40, [0]);
      expect(h.actions).toEqual(["confirm"]);
    } finally {
      h.dispose();
    }
  });
  it("requires release when a controller reconnects with confirm held", () => {
    const h = harness();
    try {
      h.disconnect(10);
      h.tick(20, [0]);
      expect(h.actions).toEqual([]);
      h.tick(30);
      h.tick(40, [0]);
      expect(h.actions).toEqual(["confirm"]);
    } finally {
      h.dispose();
    }
  });
  it("keeps discrete controller buttons edge-triggered while directions repeat", () => {
    const h = harness();
    try {
      h.tick(10, [0, 13]);
      h.tick(200, [0, 13]);
      h.tick(360, [0, 13]);
      h.tick(520, [0, 13]);
      expect(h.actions).toEqual(["confirm", "down", "down", "down"]);
    } finally {
      h.dispose();
    }
  });
  it("resolves a diagonal stick to one direction and lets the D-pad override the stick", () => {
    const pad = (buttons: number[], axes: number[]) => ({
      buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i) }) as GamepadButton),
      axes,
    });
    expect(gamepadActions(pad([], [0.7, 0.9]))).toEqual(["down"]);
    expect(gamepadActions(pad([14], [1, 0]))).toEqual(["left"]);
    expect(gamepadActions(pad([], [0.2, -0.2]))).toEqual([]);
  });
});

describe("navigation intent and lifecycle", () => {
  it("does not expose focus for Escape after pointer use, but does for navigation", () => {
    const h = harness();
    try {
      window.dispatchEvent(new Event("pointerdown"));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(h.modes).toHaveBeenLastCalledWith("keyboard", false);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
      expect(h.modes).toHaveBeenLastCalledWith("keyboard", true);
      window.dispatchEvent(new Event("pointerdown"));
      expect(h.modes).toHaveBeenLastCalledWith("pointer", false);
      h.tick(10, [1]);
      expect(h.modes).toHaveBeenLastCalledWith("controller", false);
      h.tick(20);
      h.tick(30, [13]);
      expect(h.modes).toHaveBeenLastCalledWith("controller", true);
    } finally {
      h.dispose();
    }
  });
  it("survives denied controller access and keeps keyboard input available", () => {
    const h = harness();
    try {
      vi.stubGlobal("navigator", {
        getGamepads: () => {
          throw new Error("Denied");
        },
      });
      expect(() => h.disconnect(10)).not.toThrow();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));
      expect(h.actions).toEqual(["down"]);
    } finally {
      h.dispose();
    }
  });
  it("revokes queued controller polls and keyboard listeners on disposal", () => {
    const h = harness();
    h.dispose();
    h.tick(10, [0]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(h.actions).toEqual([]);
  });
});

it("removes indicators on the first mouse movement even when movement deltas are zero", () => {
  const h = harness();
  try {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    const move = new MouseEvent("pointermove", { clientX: 20, clientY: 20 });
    window.dispatchEvent(move);
    expect(h.modes).toHaveBeenLastCalledWith("pointer", false);
    const count = h.modes.mock.calls.length;
    h.tick(10, [13]);
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 20, clientY: 20 }));
    expect(h.modes.mock.calls.length).toBe(count + 1);
    expect(h.modes).toHaveBeenLastCalledWith("controller", true);
  } finally {
    h.dispose();
  }
});

it("checks browser focus even if a blur event was missed", () => {
  const h = harness();
  try {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    h.tick(10, [0]);
    expect(h.actions).toEqual([]);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    h.tick(20, [0]);
    expect(h.actions).toEqual([]);
    h.tick(30);
    h.tick(40, [0]);
    expect(h.actions).toEqual(["confirm"]);
  } finally {
    h.dispose();
  }
});

it("moves through settings rows without skipping the offset Sound switch", () => {
  const root = document.createElement("div");
  root.className = "settings-controls";
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
  root.className = "settings-controls";
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
  root.className = "inspection";
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
  root.className = "settings-controls";
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
