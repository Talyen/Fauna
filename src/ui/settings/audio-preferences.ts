import { useEffect, useState } from "react";
import { readPreference, writePreference } from "../../platform/preferences";
export interface AudioPreferences {
  enabled: boolean;
  master: number;
  music: number;
  effects: number;
  muteInBackground: boolean;
}
export const defaultAudioPreferences: AudioPreferences = {
  enabled: true,
  master: 50,
  music: 50,
  effects: 50,
  muteInBackground: true,
};
export function normalizeAudioPreferences(value: unknown): AudioPreferences {
  const candidate = value && typeof value === "object" ? (value as Partial<AudioPreferences>) : {};
  const volume = (key: "master" | "music" | "effects") =>
    typeof candidate[key] === "number" && Number.isFinite(candidate[key])
      ? Math.max(0, Math.min(100, Math.round(candidate[key])))
      : defaultAudioPreferences[key];
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : true,
    muteInBackground: typeof candidate.muteInBackground === "boolean" ? candidate.muteInBackground : true,
    master: volume("master"),
    music: volume("music"),
    effects: volume("effects"),
  };
}
export function useAudioPreferences() {
  const [preferences, setPreferences] = useState(() => {
    try {
      return normalizeAudioPreferences(JSON.parse(readPreference("fauna.audio.v1") ?? "null"));
    } catch {
      return defaultAudioPreferences;
    }
  });
  useEffect(() => {
    writePreference("fauna.audio.v1", JSON.stringify(preferences));
  }, [preferences]);
  return [
    preferences,
    (patch: Partial<AudioPreferences>) =>
      setPreferences((previous) => {
        const next = normalizeAudioPreferences({ ...previous, ...patch });
        return next;
      }),
  ] as const;
}
