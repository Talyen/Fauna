import { useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react";
import { isAvailableFocusTarget, returnFocus } from "../shared/navigation/focus";
import type { Route } from "./types";

export function useShellFocus({
  root,
  route,
  obscured,
  menu,
  ready,
  pointer,
  phase,
  blocking,
  status,
  generation,
  instance,
}: {
  root: RefObject<HTMLDivElement | null>;
  route: Route;
  obscured: boolean;
  menu: boolean;
  ready: boolean;
  pointer: boolean;
  phase: string;
  blocking: boolean;
  status: string;
  generation: RefObject<number>;
  instance: number;
}) {
  const pauseOpener = useRef<HTMLElement | null>(null);
  const modalOpener = useRef<HTMLElement | null>(null);
  const returnAction = useRef<string | null>(null);
  const findAction = (parent: ParentNode | null, action: string) =>
    parent?.querySelector<HTMLElement>(`[data-menu-action="${action}"]`) ?? null;
  const focusScreen = useEffectEvent(() => {
    if (!ready || menu || obscured || (route === "play" && pointer)) return;
    const buttons = Array.from(
      root.current?.querySelectorAll<HTMLElement>("main button:not(:disabled)") ?? [],
    ).filter((el) => el.getClientRects().length > 0);
    if (route === "home" && returnAction.current) {
      const opener = findAction(root.current, returnAction.current);
      returnAction.current = null;
      if (opener) {
        opener.focus();
        return;
      }
    }
    if (route === "settings") {
      root.current
        ?.querySelector<HTMLElement>('.settings-screen [role="tab"][aria-selected="true"]')
        ?.focus();
      return;
    }
    if (buttons.includes(document.activeElement as HTMLElement)) return;
    (buttons.find((el) => el.classList.contains("primary-menu-action")) ?? buttons[0])?.focus();
  });
  useLayoutEffect(() => {
    focusScreen();
  }, [route, phase, ready, blocking, status]);
  return {
    modalOpener,
    rememberPauseOpener: () => {
      pauseOpener.current = document.activeElement as HTMLElement | null;
    },
    rememberDialogOpener: (fromMenu: boolean) => {
      if (fromMenu)
        returnAction.current = (document.activeElement as HTMLElement | null)?.dataset.menuAction ?? null;
      modalOpener.current = document.activeElement as HTMLElement | null;
    },
    rememberAction: (action: string | null) => {
      returnAction.current = action;
    },
    openMenuFocus: (event: Event) => {
      const action = returnAction.current;
      if (!action) return;
      returnAction.current = null;
      const opener = findAction(event.currentTarget as HTMLElement, action);
      if (opener) {
        event.preventDefault();
        opener.focus();
      }
    },
    closeMenuFocus: (event: Event) => {
      event.preventDefault();
      if (generation.current !== instance || obscured) return;
      if (route === "play") returnFocus(pauseOpener.current);
      else {
        const focused = document.activeElement as HTMLElement | null;
        if (focused !== document.body && isAvailableFocusTarget(focused)) return;
        returnFocus(
          root.current?.querySelector<HTMLElement>(
            route === "settings"
              ? '.settings-screen [role="tab"][aria-selected="true"]'
              : "main button:not(:disabled)",
          ) ?? null,
        );
      }
    },
  };
}
