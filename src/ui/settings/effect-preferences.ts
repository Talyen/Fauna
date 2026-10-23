import { useState } from "react";
import { readPreference, writePreference } from "../../platform/preferences";
export function normalizeEffectIntensity(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 100;
}
function readIntensity(key: string) {
  const raw = readPreference(key);
  return raw === null || raw.trim() === "" ? 100 : normalizeEffectIntensity(Number(raw));
}
export function useEffectPreferences() {
  const [glow, setGlow] = useState(() => readIntensity("fauna.background-glow"));
  const [particles, setParticles] = useState(() => readIntensity("fauna.background-particles"));
  return {
    glow,
    particles,
    update(key: "glow" | "particles", value: number) {
      const next = normalizeEffectIntensity(value);
      (key === "glow" ? setGlow : setParticles)(next);
      writePreference(`fauna.background-${key === "glow" ? "glow" : "particles"}`, String(next));
    },
  };
}
