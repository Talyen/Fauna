export type InputAction = "left" | "right" | "up" | "down" | "confirm" | "back" | "inspect" | "endTurn";
export function moveFocus(direction: "left" | "right" | "up" | "down") {
  const root = document.querySelector("dialog[open]") ?? document;
  const buttons = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), [tabindex="0"]',
    ),
  ).filter((e) => e.getClientRects().length > 0);
  if (!buttons.length) return;
  const current = document.activeElement as HTMLElement;
  if (!buttons.includes(current)) {
    buttons[0]!.focus();
    return;
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
  best?.focus();
}
export function gamepadActions(pad: Pick<Gamepad, "buttons" | "axes">): InputAction[] {
  const pressed = (i: number) => pad.buttons[i]?.pressed ?? false;
  const actions: InputAction[] = [];
  if (pressed(0)) actions.push("confirm");
  if (pressed(1)) actions.push("back");
  if (pressed(2)) actions.push("inspect");
  if (pressed(3)) actions.push("endTurn");
  if (pressed(14) || (pad.axes[0] ?? 0) < -0.55) actions.push("left");
  if (pressed(15) || (pad.axes[0] ?? 0) > 0.55) actions.push("right");
  if (pressed(12) || (pad.axes[1] ?? 0) < -0.55) actions.push("up");
  if (pressed(13) || (pad.axes[1] ?? 0) > 0.55) actions.push("down");
  return actions;
}
export function connectInput(
  onAction: (action: InputAction) => void,
  onMode: (mode: "keyboard" | "controller" | "pointer") => void,
) {
  const keyboard = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    const mapping: Record<string, InputAction> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      Escape: "back",
      i: "inspect",
      I: "inspect",
    };
    const action = mapping[event.key];
    onMode("keyboard");
    if (action) {
      event.preventDefault();
      onAction(action);
    }
  };
  const pointer = () => onMode("pointer");
  window.addEventListener("keydown", keyboard);
  window.addEventListener("pointerdown", pointer);
  let frame = 0;
  let previous = new Set<InputAction>();
  let repeatAt = 0;
  const poll = (now: number) => {
    const actions = new Set<InputAction>();
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (pad && pad.mapping === "standard") for (const action of gamepadActions(pad)) actions.add(action);
    }
    for (const action of actions) {
      const directional = ["left", "right", "up", "down"].includes(action);
      if (!previous.has(action) || (directional && now >= repeatAt)) {
        onMode("controller");
        onAction(action);
        if (directional) repeatAt = now + (previous.has(action) ? 160 : 350);
      }
    }
    previous = actions;
    frame = requestAnimationFrame(poll);
  };
  frame = requestAnimationFrame(poll);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", keyboard);
    window.removeEventListener("pointerdown", pointer);
  };
}
