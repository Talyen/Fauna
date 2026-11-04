import { useCallback, useEffect, useState } from "react";
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
function normalizePercentage(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}
export function normalizeAudioPreferences(value: unknown): AudioPreferences {
  const candidate = value && typeof value === "object" ? (value as Partial<AudioPreferences>) : {};
  const volume = (key: "master" | "music" | "effects") =>
    normalizePercentage(candidate[key], defaultAudioPreferences[key]);
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : defaultAudioPreferences.enabled,
    muteInBackground:
      typeof candidate.muteInBackground === "boolean"
        ? candidate.muteInBackground
        : defaultAudioPreferences.muteInBackground,
    master: volume("master"),
    music: volume("music"),
    effects: volume("effects"),
  };
}
export function normalizeEffectIntensity(value: unknown) {
  return normalizePercentage(value, 100);
}
export interface DevicePreferences {
  audio: AudioPreferences;
  glow: number;
  particles: number;
  scale: number;
  tooltipScale: number;
  autoEndTurn: boolean;
  brightness: number;
  rememberAutoplay: boolean;
  autoplay: boolean;
}
export type PreferencesPatch = Omit<Partial<DevicePreferences>, "audio"> & {
  audio?: Partial<AudioPreferences>;
};
function normalizePreferences(value: unknown): DevicePreferences {
  const candidate = value && typeof value === "object" ? (value as Partial<DevicePreferences>) : {};
  const scale = (value: unknown, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(min, Math.min(max, Math.round(value * 20) / 20))
      : 1;
  return {
    audio: { ...normalizeAudioPreferences(candidate.audio), enabled: true },
    glow: normalizeEffectIntensity(candidate.glow),
    particles: normalizeEffectIntensity(candidate.particles),
    scale: scale(candidate.scale, 0.8, 1.2),
    tooltipScale: scale(candidate.tooltipScale, 0.9, 1.25),
    autoEndTurn: typeof candidate.autoEndTurn === "boolean" ? candidate.autoEndTurn : true,
    brightness:
      typeof candidate.brightness === "number" && Number.isFinite(candidate.brightness)
        ? Math.max(50, Math.min(150, candidate.brightness))
        : 100,
    rememberAutoplay: candidate.rememberAutoplay === true,
    autoplay: candidate.autoplay === true,
  };
}
function readPreferences(): DevicePreferences {
  let audio: unknown;
  try {
    audio = JSON.parse(readPreference("fauna.audio.v1") ?? "null");
  } catch {
    // Malformed optional preferences retain defaults and never gate play.
  }
  const intensity = (key: string) => {
    const raw = readPreference(key);
    return raw === null || raw.trim() === "" ? 100 : Number(raw);
  };
  return normalizePreferences({
    audio,
    glow: intensity("fauna.background-glow"),
    particles: intensity("fauna.background-particles"),
    scale: Number(readPreference("fauna.game-scale") ?? "1"),
    tooltipScale: Number(readPreference("fauna.tooltip-scale") ?? "1"),
    autoEndTurn: (readPreference("fauna.auto-end-turn") ?? "true") !== "false",
    brightness: intensity("fauna.brightness"),
    rememberAutoplay: readPreference("fauna.remember-autoplay") === "true",
    autoplay: readPreference("fauna.autoplay") === "true",
  });
}

/** One update/persistence path; applying preferences to DOM and audio remains separate. */
export function useDevicePreferences() {
  const [preferences, setPreferences] = useState(readPreferences);
  const update = useCallback((patch: PreferencesPatch) => {
    setPreferences((previous) => {
      const next = normalizePreferences({
        ...previous,
        ...patch,
        audio: { ...previous.audio, ...patch.audio },
      });
      // Unrelated settings must not reconfigure live audio.
      if (!patch.audio) next.audio = previous.audio;
      return next;
    });
  }, []);
  useEffect(() => {
    const stored = {
      "fauna.audio.v1": JSON.stringify(preferences.audio),
      "fauna.background-glow": String(preferences.glow),
      "fauna.background-particles": String(preferences.particles),
      "fauna.game-scale": String(preferences.scale),
      "fauna.tooltip-scale": String(preferences.tooltipScale),
      "fauna.auto-end-turn": String(preferences.autoEndTurn),
      "fauna.brightness": String(preferences.brightness),
      "fauna.remember-autoplay": String(preferences.rememberAutoplay),
      "fauna.autoplay": String(preferences.autoplay),
    };
    for (const [key, value] of Object.entries(stored)) writePreference(key, value);
  }, [preferences]);
  useEffect(() => {
    const apply = () => {
      const fit = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
      const density = (fit <= 1 ? fit : 1 + (fit - 1) * 0.72) * preferences.scale;
      const style = document.documentElement.style;
      style.setProperty("--ui-density", String(density));
      style.setProperty("--text-scale", String(density));
      style.setProperty("--tooltip-scale", String(density * preferences.tooltipScale));
      style.setProperty("--game-brightness", String(preferences.brightness / 100));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [preferences.scale, preferences.tooltipScale, preferences.brightness]);
  return [preferences, update] as const;
}
export const defaultDevicePreferences = normalizePreferences({});
