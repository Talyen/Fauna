import { useEffect } from "react";
import type { SoundCue } from "./audio-runtime";

export function useActivationAudio(playSound: (cue: SoundCue) => void) {
  useEffect(() => {
    const activate = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>("button") : null;
      if (!button || button.matches(':disabled, [aria-disabled="true"]') || button.closest("[inert]")) return;
      if (
        button.matches(
          ".home-screen button, .menu-panel button, .settings-screen button, .ui-tab, .dialog-close",
        )
      )
        playSound("activate");
    };
    window.addEventListener("click", activate);
    return () => window.removeEventListener("click", activate);
  }, [playSound]);
}
