import { useEffect, useRef, useState } from "react";
import { parsePlasmaHexColor, type PlasmaColorPair } from "./rendering/plasma-colors";
import { startKeywordPlasma, type PlasmaColorState } from "./rendering/keyword-plasma";
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

// Critically damped: retain velocity across retargets, settling in about 800 ms.
const COLOR_SPRING_RATE = 0.012;
const COLOR_SETTLE_EPSILON = 1 / 4096;
const GLOW_BRIGHTNESS = 0.8;

export function KeywordPlasmaBackground({
  colorPair: explicitColorPair,
  black,
  motionAllowed,
  intensity = 100,
}: {
  colorPair?: PlasmaColorPair | null | undefined;
  black: string;
  motionAllowed: boolean;
  intensity?: number | undefined;
}) {
  const [webglAvailable, setWebglAvailable] = useState(() => typeof WebGLRenderingContext !== "undefined");
  const visible = intensity > 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorPair = explicitColorPair ?? null;
  const hasColorPair = colorPair !== null;
  const activePair = colorPair ?? { primary: black, secondary: black };
  const targetPrimary = activePair.primary;
  const targetSecondary = activePair.secondary;

  const colorsRef = useRef<PlasmaColorState>({
    primary: targetPrimary,
    secondary: targetSecondary,
  });
  const activeRef = useRef(colorPair !== null);
  const wakeRef = useRef<() => void>(() => {});
  const velocityRef = useRef({ primary: [0, 0, 0], secondary: [0, 0, 0] });

  useEffect(() => {
    const currentTarget = { primary: targetPrimary, secondary: targetSecondary };

    if (!motionAllowed || !visible || !webglAvailable) {
      velocityRef.current.primary.fill(0);
      velocityRef.current.secondary.fill(0);
      colorsRef.current = currentTarget;
      activeRef.current = hasColorPair;
      return;
    }
    const from = { ...colorsRef.current };
    if (from.primary === targetPrimary && from.secondary === targetSecondary) {
      activeRef.current = hasColorPair;
      if (hasColorPair) wakeRef.current();
      return;
    }
    activeRef.current = true;
    wakeRef.current();

    let previousTime = performance.now();
    // Interrupted fades need owned starting tuples; the previous fade's output
    // is mutable, and must never become the next fade's working buffer.
    const fromPrimary =
      typeof from.primary === "string"
        ? parsePlasmaHexColor(from.primary)
        : ([...from.primary] as [number, number, number]);
    const fromSecondary =
      typeof from.secondary === "string"
        ? parsePlasmaHexColor(from.secondary)
        : ([...from.secondary] as [number, number, number]);
    const toPrimary = parsePlasmaHexColor(currentTarget.primary);
    const toSecondary = parsePlasmaHexColor(currentTarget.secondary);
    const velocity = velocityRef.current;
    const channels = [
      [fromPrimary, toPrimary, velocity.primary],
      [fromSecondary, toSecondary, velocity.secondary],
    ] as const;
    const mixedColors: PlasmaColorState = { primary: fromPrimary, secondary: fromSecondary };
    let frame: number | undefined;
    let idleTimer: number | undefined;

    function tick(now: number) {
      const dt = Math.max(0, now - previousTime);
      previousTime = now;
      const decay = Math.exp(-COLOR_SPRING_RATE * dt);
      let settled = true;
      for (const [color, target, speed] of channels) {
        for (let channel = 0; channel < 3; channel++) {
          const c = color[channel] ?? 0;
          const t = target[channel] ?? 0;
          const s = speed[channel] ?? 0;
          const offset = c - t;
          const momentum = s + COLOR_SPRING_RATE * offset;
          const next = t + (offset + momentum * dt) * decay;
          color[channel] = clamp01(next);
          const nextSpeed = next === color[channel] ? (s - COLOR_SPRING_RATE * momentum * dt) * decay : 0;
          speed[channel] = nextSpeed;
          if (
            Math.abs((color[channel] ?? 0) - t) > COLOR_SETTLE_EPSILON ||
            Math.abs(nextSpeed) > COLOR_SETTLE_EPSILON * COLOR_SPRING_RATE
          ) {
            settled = false;
          }
        }
      }
      colorsRef.current = mixedColors;
      if (!settled) {
        frame = requestAnimationFrame(tick);
      } else {
        colorsRef.current = currentTarget;
        velocity.primary.fill(0);
        velocity.secondary.fill(0);
        if (!hasColorPair) {
          // Let the renderer paint the final black frame before going idle.
          idleTimer = window.setTimeout(() => {
            activeRef.current = false;
          }, 100);
        }
        frame = undefined;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
    };
  }, [hasColorPair, targetPrimary, targetSecondary, motionAllowed, visible, webglAvailable]);

  useEffect(() => {
    if (!motionAllowed || !visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (typeof WebGLRenderingContext === "undefined") {
      return;
    }
    const stop = startKeywordPlasma({
      canvas,
      onAvailabilityChange: setWebglAvailable,
      colorsRef,
      active: () => activeRef.current,
      onWakeReady: (wake) => {
        wakeRef.current = wake;
      },
    });

    return () => stop();
  }, [motionAllowed, visible]);

  if (intensity <= 0 || !motionAllowed) return null;

  return (
    <div
      aria-hidden
      className="effect-plasma"
      data-plasma-primary={targetPrimary}
      data-plasma-secondary={targetSecondary}
      style={{ opacity: clamp01(intensity / 100) * GLOW_BRIGHTNESS }}
    >
      <canvas
        ref={canvasRef}
        data-testid="global-plasma-background"
        className="effect-fill"
        style={{ visibility: webglAvailable ? "visible" : "hidden" }}
      />
      {!webglAvailable && motionAllowed && colorPair !== null ? (
        <div
          data-testid="static-plasma-background"
          className="effect-fill"
          style={{
            background: `radial-gradient(ellipse at 50% calc(50% - 0px), color-mix(in srgb, ${targetPrimary} 13%, transparent), color-mix(in srgb, ${targetSecondary} 7%, transparent) 35%, transparent 75%)`,
          }}
        />
      ) : null}
    </div>
  );
}
