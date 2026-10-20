import { useCallback, useEffect, useRef } from "react";
import type { Session } from "../application/session";
import type { AudioPreferences } from "./audio-preferences";
import { createAudioRuntime, type MusicCue, type SoundCue } from "./audio-runtime";
export function useGameAudio(session: Session, preferences: AudioPreferences, home: boolean) {
  const owner = useRef<ReturnType<typeof createAudioRuntime> | null>(null);
  const currentPreferences = useRef(preferences);
  currentPreferences.current = preferences;
  useEffect(() => {
    const audio = createAudioRuntime(
      (error) => session.diagnostics.record("audio", error, session.store.getState().game),
      undefined,
      typeof __FAUNA_QUIET_PREVIEW__ === "boolean" && __FAUNA_QUIET_PREVIEW__,
    );
    owner.current = audio;
    audio.configure(currentPreferences.current);
    const unlock = () => audio.unlock();
    const visibility = () => audio.background(document.hidden || !document.hasFocus());
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", visibility);
    visibility();
    const unsubscribe = session.store.subscribe((current, previous) => {
      if (!current.committedCommand || current.committedCommand === previous.committedCommand) return;
      const type = current.committedCommand.type;
      const cue: SoundCue | undefined =
        type === "buyTalent"
          ? "talent"
          : type === "recruit"
            ? "recruit"
            : type === "play" || type === "endTurn"
              ? current.game.phase === "victory" ||
                current.game.phase === "recruit" ||
                current.game.phase === "relic"
                ? "victory"
                : current.game.phase === "defeat"
                  ? "defeat"
                  : undefined
              : undefined;
      if (cue) {
        audio.unlock();
        audio.play(cue);
      }
    });
    return () => {
      unsubscribe();
      owner.current = null;
      audio.dispose();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
      window.removeEventListener("blur", visibility);
    };
  }, [session]);
  const game = session.store.getState().game;
  const track: MusicCue =
    home || !["battle", "teamSelection", "recruit", "relic"].includes(game.phase)
      ? "menu"
      : game.expedition?.step === 3
        ? "boss"
        : game.expedition?.biome === 1
          ? "marsh"
          : "fernwood";
  useEffect(() => {
    owner.current?.configure(preferences);
  }, [preferences]);
  useEffect(() => {
    owner.current?.music(track);
  }, [track, session]);
  return useCallback((cue: SoundCue) => {
    owner.current?.unlock();
    owner.current?.play(cue);
  }, []);
}
