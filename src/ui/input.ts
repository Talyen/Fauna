import { isAvailableFocusTarget } from "./focus";

// Game navigation forwards arrow events to Radix without changing the active input device.
const bridgedKeys = new WeakSet<KeyboardEvent>();
export type InputAction = "left" | "right" | "up" | "down" | "confirm" | "back" | "inspect" | "endTurn";
export function moveFocus(direction: "left" | "right" | "up" | "down") {
  const root =
    Array.from(
      document.querySelectorAll(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], dialog[open]',
      ),
    ).at(-1) ?? document;
  const focused = document.activeElement as HTMLElement | null;
  const composite = focused?.closest('[role="tablist"], [role="radiogroup"]');
  if (composite && (root === document || root.contains(composite))) {
    const horizontal = composite.getAttribute("aria-orientation") !== "vertical";
    if (
      (horizontal && (direction === "left" || direction === "right")) ||
      (!horizontal && (direction === "up" || direction === "down"))
    ) {
      const key = { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" }[direction];
      const event = new KeyboardEvent("keydown", { key, bubbles: true });
      bridgedKeys.add(event);
      focused?.dispatchEvent(event);
      // Radix schedules roving focus. Release after that focus settles so radio
      // selection follows navigation and its held-arrow state cannot leak.
      setTimeout(() => focused?.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true })), 0);
      return;
    }
  }
  const buttons = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), [tabindex="0"]',
    ),
  ).filter(isAvailableFocusTarget);
  if (!buttons.length) return;
  const current = document.activeElement as HTMLElement;
  if (!buttons.includes(current)) {
    buttons[0]!.focus();
    return;
  }
  if (
    (root === document && current.closest(".battle-screen, .team-selection, .talents-screen")) ||
    current.closest(".swap-roster, .settings-controls")
  ) {
    const rows = Array.from(
      root.querySelectorAll<HTMLElement>(".enemy-row, .player-row, .hand, [data-nav-row]"),
    ).filter((row) => row.getClientRects().length > 0 && row.querySelector("button"));
    const rowIndex = rows.findIndex((row) => row.contains(current));
    if (rowIndex >= 0) {
      if (direction === "left" || direction === "right") {
        const peers = buttons.filter((button) => rows[rowIndex]!.contains(button));
        const index = peers.indexOf(current);
        peers[(index + (direction === "left" ? -1 : 1) + peers.length) % peers.length]?.focus();
        return;
      }
      const next = rows[rowIndex + (direction === "up" ? -1 : 1)];
      if (next) {
        const x = current.getBoundingClientRect().x + current.getBoundingClientRect().width / 2;
        buttons
          .filter((button) => next.contains(button))
          .sort(
            (a, b) =>
              Math.abs(a.getBoundingClientRect().x + a.getBoundingClientRect().width / 2 - x) -
              Math.abs(b.getBoundingClientRect().x + b.getBoundingClientRect().width / 2 - x),
          )[0]
          ?.focus();
      }
      if (next) return;
    }
  }
  const r = current.getBoundingClientRect(),
    x = r.x + r.width / 2,
    y = r.y + r.height / 2;
  let best: HTMLElement | undefined,
    score = Infinity;
  for (const el of buttons) {
    if (el === current) continue;
    const b = el.getBoundingClientRect(),
      dx = b.x + b.width / 2 - x,
      dy = b.y + b.height / 2 - y;
    const primary = direction === "left" ? -dx : direction === "right" ? dx : direction === "up" ? -dy : dy;
    const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    if (primary <= 2) continue;
    const cost = primary + secondary * 3;
    if (cost < score) {
      best = el;
      score = cost;
    }
  }
  if (best) best.focus();
  else if (root instanceof HTMLElement)
    root.scrollBy({
      top: direction === "up" ? -100 : direction === "down" ? 100 : 0,
      left: direction === "left" ? -100 : direction === "right" ? 100 : 0,
    });
}
export function gamepadActions(pad: Pick<Gamepad, "buttons" | "axes">): InputAction[] {
  const pressed = (i: number) => pad.buttons[i]?.pressed ?? false;
  const actions: InputAction[] = [];
  if (pressed(0)) actions.push("confirm");
  if (pressed(1)) actions.push("back");
  if (pressed(2)) actions.push("inspect");
  if (pressed(3)) actions.push("endTurn");
  // One direction per sample keeps diagonals from skipping grid items. The
  // deliberate D-pad takes priority over an off-center stick.
  const dpad = [14, 15, 12, 13].some(pressed);
  const x = dpad ? Number(pressed(15)) - Number(pressed(14)) : (pad.axes[0] ?? 0);
  const y = dpad ? Number(pressed(13)) - Number(pressed(12)) : (pad.axes[1] ?? 0);
  if (Math.max(Math.abs(x), Math.abs(y)) > 0.55) {
    if (Math.abs(x) > Math.abs(y)) actions.push(x < 0 ? "left" : "right");
    else actions.push(y < 0 ? "up" : "down");
  }
  return actions;
}
export function connectInput(
  onAction: (action: InputAction) => void,
  onMode: (mode: "keyboard" | "controller" | "pointer", navigation: boolean) => void,
) {
  let interactionMode: "keyboard" | "controller" | "pointer" | undefined;
  let navigation = false;
  let suspended = document.visibilityState === "hidden";
  let disposed = false;
  let previous = new Set<InputAction>();
  let connected = new Set<number>();
  const blocked = new Set<InputAction>();
  const repeatAt = new Map<InputAction, number>();
  const changeMode = (mode: "keyboard" | "controller" | "pointer", navigating = navigation) => {
    if (mode !== "controller") for (const action of previous) blocked.add(action);
    if (mode === interactionMode && navigating === navigation) return;
    interactionMode = mode;
    navigation = navigating;
    onMode(mode, navigation);
  };
  const keyboard = (event: KeyboardEvent) => {
    if (suspended || bridgedKeys.has(event)) return;
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.defaultPrevented ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    )
      return;
    const mapping: Record<string, InputAction> = {
      a: "left",
      A: "left",
      d: "right",
      D: "right",
      w: "up",
      W: "up",
      s: "down",
      S: "down",
      Escape: "back",
      i: "inspect",
      I: "inspect",
    };
    const action = mapping[event.key];
    const navigating =
      (action && ["left", "right", "up", "down"].includes(action)) ||
      [
        "Tab",
        "Enter",
        " ",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ].includes(event.key);
    if (action || navigating) changeMode("keyboard", navigating || navigation);
    if (action) {
      event.preventDefault();
      if (event.repeat && (action === "back" || action === "inspect")) return;
      onAction(action);
    }
  };
  const keyup = (event: KeyboardEvent) => {
    // WASD is translated into an arrow-key pair for composite shadcn widgets.
    // Its physical keyup must not release Radix's arrow state before roving focus.
    if (
      /^[wasd]$/i.test(event.key) &&
      event.target instanceof HTMLElement &&
      event.target.closest('[role="tablist"], [role="radiogroup"]')
    )
      event.stopPropagation();
  };
  let pointerPosition: { x: number; y: number } | undefined;
  const pointer = (event: PointerEvent) => {
    if (suspended) return;
    const unchanged = pointerPosition?.x === event.clientX && pointerPosition?.y === event.clientY;
    pointerPosition = { x: event.clientX, y: event.clientY };
    if (event.type === "pointermove" && unchanged && !event.movementX && !event.movementY) return;
    changeMode("pointer", false);
  };
  const wheel = () => {
    if (!suspended) changeMode("pointer", false);
  };
  const suspend = () => {
    suspended = true;
    previous.clear();
    connected.clear();
    repeatAt.clear();
    changeMode(interactionMode ?? "pointer", false);
  };
  const resume = () => {
    suspended = document.visibilityState === "hidden";
  };
  const visibility = () => {
    if (document.visibilityState === "hidden") suspend();
    else resume();
  };
  window.addEventListener("keydown", keyboard, true);
  window.addEventListener("keyup", keyup, true);
  window.addEventListener("pointerdown", pointer, true);
  window.addEventListener("pointermove", pointer, true);
  window.addEventListener("wheel", wheel, { capture: true, passive: true });
  window.addEventListener("blur", suspend);
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", visibility);
  let frame = 0;
  const poll = (now: number) => {
    if (disposed) return;
    const actions = new Set<InputAction>();
    const present = new Set<number>();
    let pads: (Gamepad | null)[] = [];
    try {
      if (!suspended && document.hasFocus()) pads = navigator.getGamepads?.() ?? [];
    } catch {
      // Restricted browser contexts may deny controller access; other input remains usable.
    }
    for (const [index, pad] of pads.entries()) {
      if (!pad || pad.connected === false || pad.mapping !== "standard") continue;
      present.add(index);
      for (const action of gamepadActions(pad)) {
        actions.add(action);
        // A newly connected or resumed controller must release held controls.
        if (!connected.has(index)) blocked.add(action);
      }
    }
    connected = present;
    for (const action of blocked) if (!actions.has(action)) blocked.delete(action);
    for (const action of actions) {
      if (blocked.has(action) || disposed) continue;
      const directional = ["left", "right", "up", "down"].includes(action);
      if (!previous.has(action) || (directional && now >= (repeatAt.get(action) ?? 0))) {
        changeMode("controller", navigation || directional || action === "confirm" || action === "inspect");
        onAction(action);
        if (directional) repeatAt.set(action, now + (previous.has(action) ? 160 : 350));
      }
    }
    previous = actions;
    if (!disposed) frame = requestAnimationFrame(poll);
  };
  frame = requestAnimationFrame(poll);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", keyboard, true);
    window.removeEventListener("keyup", keyup, true);
    window.removeEventListener("pointerdown", pointer, true);
    window.removeEventListener("pointermove", pointer, true);
    window.removeEventListener("wheel", wheel, true);
    window.removeEventListener("blur", suspend);
    window.removeEventListener("focus", resume);
    document.removeEventListener("visibilitychange", visibility);
  };
}
