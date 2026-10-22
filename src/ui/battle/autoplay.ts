import { useCallback, useEffect, useRef, useState } from "react";
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
  const [enabled, setEnabledState] = useState(false);
  const enabledNow = useRef(false);
  const setEnabled = useCallback((value: boolean) => {
    // Manual takeover revokes queued work before React commits effect cleanup.
    enabledNow.current = value;
    setEnabledState(value);
  }, []);
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
  useEffect(
    () =>
      session.store.subscribe((current) => {
        if (current.game.phase !== "battle" || current.closing || !current.ready) setEnabled(false);
      }),
    [session, setEnabled],
  );
  useEffect(() => {
    if (!enabled || paused || !foreground || view.closing || view.game.phase !== "battle") return;
    const revision = view.game.revision;
    return scheduleAutoplay(() => {
      const current = session.store.getState();
      if (
        !enabledNow.current ||
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
  }, [
    session,
    enabled,
    paused,
    foreground,
    autoEndTurn,
    view.game.revision,
    view.game.phase,
    view.closing,
    setEnabled,
  ]);
  return [enabled, setEnabled] as const;
}
