import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { Session } from "../../application/session";
import { chooseBattleCommand } from "../../application/battle-policy";

/** One pending action per owner; cancellation invalidates even a queued timer callback. */
export function scheduleAutoplay(action: () => void, schedule = setTimeout, cancel = clearTimeout) {
  let active = true;
  const timer = schedule(() => {
    if (active) action();
  }, 700);
  return () => {
    active = false;
    cancel(timer);
  };
}
export function useAutoplay(session: Session, paused: boolean, autoEndTurn: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [foreground, setForeground] = useState(
    () => document.visibilityState !== "hidden" && document.hasFocus(),
  );
  const foregroundNow = useRef(foreground);
  const view = useStore(session.store);
  useEffect(() => {
    const updateForeground = (value: boolean) => {
      // Revoke queued actions before React commits the corresponding effect cleanup.
      foregroundNow.current = value;
      setForeground(value);
    };
    const blur = () => updateForeground(false);
    const focus = () => updateForeground(document.visibilityState !== "hidden" && document.hasFocus());
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  useEffect(() => {
    if (view.game.phase !== "battle" || view.closing || !view.ready) setEnabled(false);
  }, [view.game.phase, view.closing, view.ready]);
  useEffect(() => {
    if (!enabled || paused || !foreground || view.closing || view.game.phase !== "battle") return;
    const revision = view.game.revision;
    return scheduleAutoplay(() => {
      const current = session.store.getState();
      if (
        !foregroundNow.current ||
        document.visibilityState === "hidden" ||
        !document.hasFocus() ||
        current.game.revision !== revision ||
        current.closing ||
        current.overlayActive ||
        current.cloud.blocking ||
        current.game.phase !== "battle"
      )
        return;
      if (!session.command(chooseBattleCommand(current.game, autoEndTurn))) setEnabled(false);
    });
  }, [session, enabled, paused, foreground, autoEndTurn, view.game.revision, view.game.phase, view.closing]);
  return [enabled, setEnabled] as const;
}
