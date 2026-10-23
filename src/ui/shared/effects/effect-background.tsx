import { useEffect, useRef, useState } from "react";
import { readEffectTokens, resolveEffectColor, type EffectPalette } from "./palettes";
import type { ParticleScene } from "./effects-store";
import { startBackgroundParticles } from "./rendering/background-particles";
import { KeywordPlasmaBackground } from "./plasma-background";

function useAnimationActivity() {
  const [active, setActive] = useState(() => !document.hidden && document.hasFocus());
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(query?.matches ?? false);
    const activity = () => setActive(!document.hidden && document.hasFocus());
    query?.addEventListener("change", motion);
    document.addEventListener("visibilitychange", activity);
    window.addEventListener("focus", activity);
    window.addEventListener("blur", activity);
    return () => {
      query?.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", activity);
      window.removeEventListener("focus", activity);
      window.removeEventListener("blur", activity);
    };
  }, []);
  return active && !reduced;
}

function Particles({
  scene,
  intensity,
  tokens,
}: {
  scene: ParticleScene;
  intensity: number;
  tokens: Record<string, string>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (typeof CanvasRenderingContext2D === "undefined") return;
    const family =
      scene === "battle" || scene === "boss" ? "battle" : scene === "campfire" ? "campfire" : "embers";
    const multiplier = scene === "boss" ? 2.9 : scene === "battle" ? 2 : 1;
    return startBackgroundParticles(
      canvas,
      [tokens[`effect-${family}-primary`]!, tokens[`effect-${family}-secondary`]!],
      (multiplier * intensity) / 100,
      family === "battle" ? 80 : 40,
    );
  }, [scene, intensity, tokens]);
  return (
    <canvas ref={canvas} className="effect-fill" data-testid="background-particles" aria-hidden="true" />
  );
}
export function EffectBackground({
  palette,
  scene,
  glow,
  particles,
}: {
  palette: EffectPalette | null;
  scene: ParticleScene;
  glow: number;
  particles: number;
}) {
  const [tokens] = useState(readEffectTokens);
  const motionAllowed = useAnimationActivity();
  return (
    <div
      className="effect-backdrop"
      aria-hidden="true"
      data-effects-active={motionAllowed}
      data-active-palette={palette?.keywords.join(" ") ?? ""}
      data-effect-scene={scene}
    >
      {motionAllowed && particles > 0 && scene !== "none" ? (
        <Particles scene={scene} intensity={particles} tokens={tokens} />
      ) : null}
      <KeywordPlasmaBackground
        colorPair={
          palette
            ? {
                primary: resolveEffectColor(palette.plasma.primary, tokens),
                secondary: resolveEffectColor(palette.plasma.secondary, tokens),
              }
            : null
        }
        black={tokens.black!}
        intensity={glow}
        motionAllowed={motionAllowed}
      />
    </div>
  );
}
