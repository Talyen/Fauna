import { useCallback, useEffect, useState } from "react";
import { readPreference, writePreference } from "../../platform/preferences";
import type { ControllerPreference } from "../shared/navigation/controller-prompts";

export const TEXT_SCALES = [0.75, 1, 1.25] as const;
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
  controller: ControllerPreference;
}
export type PreferencesPatch = Omit<Partial<DevicePreferences>, "audio"> & {
  audio?: Partial<AudioPreferences>;
};
function normalizePreferences(value: unknown): DevicePreferences {
  const candidate = value && typeof value === "object" ? (value as Partial<DevicePreferences>) : {};
  const scale = (candidate: unknown) => TEXT_SCALES.find((scale) => scale === candidate) ?? 1;
  return {
    audio: normalizeAudioPreferences(candidate.audio),
    glow: normalizeEffectIntensity(candidate.glow),
    particles: normalizeEffectIntensity(candidate.particles),
    scale: scale(candidate.scale),
    tooltipScale: scale(candidate.tooltipScale),
    autoEndTurn: typeof candidate.autoEndTurn === "boolean" ? candidate.autoEndTurn : true,
    controller:
      candidate.controller === "xbox" ||
      candidate.controller === "playstation" ||
      candidate.controller === "nintendo"
        ? candidate.controller
        : "auto",
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
    scale: Number(readPreference("fauna.text-scale") ?? "1"),
    tooltipScale: Number(readPreference("fauna.tooltip-scale") ?? "1"),
    autoEndTurn: (readPreference("fauna.auto-end-turn") ?? "true") !== "false",
    controller: readPreference("fauna.controller-prompts"),
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
      "fauna.text-scale": String(preferences.scale),
      "fauna.tooltip-scale": String(preferences.tooltipScale),
      "fauna.auto-end-turn": String(preferences.autoEndTurn),
      "fauna.controller-prompts": preferences.controller,
    };
    for (const [key, value] of Object.entries(stored)) writePreference(key, value);
  }, [preferences]);
  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", String(preferences.scale));
    document.documentElement.style.setProperty("--tooltip-scale", String(preferences.tooltipScale));
  }, [preferences.scale, preferences.tooltipScale]);
  return [preferences, update] as const;
}
