import type { MutableRefObject } from "react";
export type Controls = MutableRefObject<((action: InputAction) => boolean) | null>;

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
  const composite = focused?.closest('[role="tablist"], [role="radiogroup"], [role="slider"]');
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
    buttons[0]!.focus({ preventScroll: true });
    return;
  }
  const region = current.closest<HTMLElement>('[data-nav-layout="rows"]');
  if (region && (root === document || root.contains(region))) {
    const rowSelector = "[data-nav-row]";
    const rows = Array.from(region.querySelectorAll<HTMLElement>(rowSelector)).filter(
      (row) =>
        row.closest('[data-nav-layout="rows"]') === region &&
        row.getClientRects().length > 0 &&
        buttons.some((button) => row.contains(button)) &&
        !row.parentElement?.closest(rowSelector),
    );
    const rowIndex = rows.findIndex((row) => row.contains(current));
    if (rowIndex >= 0) {
      if (direction === "left" || direction === "right") {
        const peers = buttons.filter((button) => rows[rowIndex]!.contains(button));
        const index = peers.indexOf(current);
        peers[(index + (direction === "left" ? -1 : 1) + peers.length) % peers.length]?.focus({
          preventScroll: true,
        });
        return;
      }
      const next = rows[rowIndex + (direction === "up" ? -1 : 1)];
      if (next) {
        const currentRect = current.getBoundingClientRect();
        const x = currentRect.x + currentRect.width / 2;
        let closest: HTMLElement | undefined;
        let distance = Infinity;
        for (const button of buttons) {
          if (!next.contains(button)) continue;
          const rect = button.getBoundingClientRect();
          const candidate = Math.abs(rect.x + rect.width / 2 - x);
          if (!closest || candidate < distance) {
            closest = button;
            distance = candidate;
          }
        }
        closest?.focus({ preventScroll: true });
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
  if (best) best.focus({ preventScroll: true });
}
/** Steam Input uses keyboard/pointer events through this same adapter. */
export function connectInput(
  onAction: (action: InputAction) => void,
  onMode: (mode: "keyboard" | "controller" | "pointer", navigation: boolean) => void,
  externallySuspended: () => boolean = () => false,
) {
  let navigation = false;
  let suspended = document.visibilityState === "hidden";
  const publish = (keyboard: boolean) => onMode(keyboard ? "keyboard" : "pointer", navigation);
  const keyboard = (event: KeyboardEvent) => {
    if (bridgedKeys.has(event)) return;
    if (externallySuspended() || suspended || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.repeat && ["Enter", " ", "Escape"].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.matches("input, textarea, select") || target?.isContentEditable) return;
    // Local confirmations own dismissal and focus return without navigating their page.
    if (event.key === "Escape" && target?.closest('[data-native-escape][data-state="open"]')) return;
    const nativeSelect =
      target?.closest("[data-radix-select-content]") ||
      (target?.getAttribute("role") === "combobox" &&
        (target.getAttribute("aria-expanded") === "true" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown"));
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
    if (!navigation && event.repeat && ["left", "right", "up", "down"].includes(action ?? "")) return;
    if (
      (event.key === "Tab" ||
        event.key === "F7" ||
        (["Enter", " "].includes(event.key) && target?.closest('button, [role="button"]')) ||
        (nativeSelect && ["Home", "End", "Enter", " "].includes(event.key)) ||
        ["left", "right", "up", "down"].includes(action ?? "")) &&
      !event.repeat
    )
      navigation = true;
    if (event.key === "Escape" && !nativeSelect) navigation = false;
    publish(true);
    // Native dropdowns own their keys and focus, but still update input modality.
    if (nativeSelect) return;
    if (event.key === "F7") {
      event.preventDefault();
      const controls = [
        ...document.querySelectorAll<HTMLElement>('button, [tabindex="0"], input, select'),
      ].filter((element) => element.tabIndex >= 0 && isAvailableFocusTarget(element));
      const index = controls.indexOf(document.activeElement as HTMLElement);
      controls[(index < 0 ? controls.length - 1 : index - 1 + controls.length) % controls.length]?.focus({
        preventScroll: true,
      });
    } else if (action) {
      const widget = target?.closest('[role="tablist"], [role="radiogroup"], [role="slider"]');
      const leavesTabs =
        widget?.getAttribute("role") === "tablist" &&
        (widget.getAttribute("aria-orientation") === "vertical"
          ? action === "left" || action === "right"
          : action === "up" || action === "down");
      if (widget && action !== "back" && !leavesTabs) return;
      event.preventDefault();
      if (!event.repeat || !["back", "inspect"].includes(action)) onAction(action);
    }
  };
  const pointer = () => {
    navigation = false;
    publish(false);
  };
  const blur = () => {
    suspended = true;
    navigation = false;
    publish(false);
  };
  const focus = () => {
    suspended = document.visibilityState === "hidden";
  };
  const visibility = () => (document.visibilityState === "hidden" ? blur() : focus());
  window.addEventListener("keydown", keyboard, true);
  window.addEventListener("pointerdown", pointer, true);
  window.addEventListener("pointermove", pointer, true);
  window.addEventListener("wheel", pointer, true);
  window.addEventListener("blur", blur);
  window.addEventListener("focus", focus);
  document.addEventListener("visibilitychange", visibility);
  return () => {
    window.removeEventListener("keydown", keyboard, true);
    window.removeEventListener("pointerdown", pointer, true);
    window.removeEventListener("pointermove", pointer, true);
    window.removeEventListener("wheel", pointer, true);
    window.removeEventListener("blur", blur);
    window.removeEventListener("focus", focus);
    document.removeEventListener("visibilitychange", visibility);
  };
}
