import { lerp } from "./math";
import { createCanvasLifecycle } from "./canvas-lifecycle";

interface BackgroundParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  speed: number;
  swayAmplitude: number;
  swaySpeed: number;
  swayOffset: number;
  color: string;
}

const PARTICLE_SIZE = [1.5, 3] as const;
const PARTICLE_ALPHA = [0.08, 0.3] as const;
const PARTICLE_SPEED = [3, 8] as const;
const DEFAULT_PARTICLE_COUNT = 40;
const MAX_PARTICLE_BACKING_SCALE = 1.5;
const MAX_PARTICLE_BACKING_PIXELS = 3_000_000;
const MIN_PARTICLE_BACKING_SCALE = 0.25;

function spawnParticle(
  width: number,
  height: number,
  colors: readonly string[],
  intensity: number,
): BackgroundParticle {
  const alpha = lerp(PARTICLE_ALPHA[0] * intensity, PARTICLE_ALPHA[1] * intensity, Math.random());
  const rawColor = colors[Math.floor(Math.random() * colors.length)];
  const y = Math.random() * height;
  return {
    x: Math.random() * width,
    y,
    size: lerp(PARTICLE_SIZE[0], PARTICLE_SIZE[1], Math.random()),
    alpha: 0,
    baseAlpha: alpha,
    speed: lerp(PARTICLE_SPEED[0], PARTICLE_SPEED[1], Math.random()),
    swayAmplitude: 10 + Math.random() * 30,
    swaySpeed: 0.2 + Math.random() * 0.4,
    swayOffset: Math.random() * Math.PI * 2,
    color: rawColor ?? colors[0]!,
  };
}

function updateParticle(p: BackgroundParticle, dt: number, now: number, width: number, height: number): void {
  const fadeMargin = height * 0.15;

  p.y -= p.speed * dt;
  p.x += Math.sin(p.swayOffset + now * 0.001 * p.swaySpeed) * 0.3 * dt;

  if (p.y < -fadeMargin) {
    p.y = height + fadeMargin;
    p.x = Math.random() * width;
    p.alpha = 0;
  } else if (p.y > height - fadeMargin) {
    p.alpha = lerp(0, p.baseAlpha, 1 - (p.y - (height - fadeMargin)) / fadeMargin);
  } else if (p.y < fadeMargin) {
    p.alpha = lerp(0, p.baseAlpha, p.y / fadeMargin);
  } else {
    if (p.alpha < p.baseAlpha) {
      p.alpha = Math.min(p.alpha + dt * 0.15, p.baseAlpha);
    }
  }
}

function renderParticle(ctx: CanvasRenderingContext2D, p: BackgroundParticle): void {
  ctx.globalAlpha = p.alpha;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

export function startBackgroundParticles(
  canvasRef: { current: HTMLCanvasElement | null },
  colors: readonly string[],
  alphaMultiplier?: number,
  particleCount?: number,
): () => void {
  const canvas = canvasRef.current;
  if (!canvas) return () => {};

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  if (!canvas.parentElement) return () => {};

  let particles: BackgroundParticle[] = [];
  let logicalWidth = 0;
  let logicalHeight = 0;

  const lifecycle = createCanvasLifecycle({
    canvas,
    backingScale: {
      scaleMultiplier: 1,
      minScale: MIN_PARTICLE_BACKING_SCALE,
      maxScale: MAX_PARTICLE_BACKING_SCALE,
      maxPixels: MAX_PARTICLE_BACKING_PIXELS,
    },
    onResize: (w, h) => {
      if (w <= 0 || h <= 0) {
        logicalWidth = 0;
        logicalHeight = 0;
        return;
      }
      ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
      if (particles.length === 0 || logicalWidth <= 0 || logicalHeight <= 0) {
        particles = Array.from({ length: particleCount ?? DEFAULT_PARTICLE_COUNT }, () =>
          spawnParticle(w, h, colors, alphaMultiplier ?? 1),
        );
      } else if (w !== logicalWidth || h !== logicalHeight) {
        const scaleX = w / logicalWidth;
        const scaleY = h / logicalHeight;
        for (const p of particles) {
          p.x *= scaleX;
          p.y *= scaleY;
        }
      }
      logicalWidth = w;
      logicalHeight = h;
    },
    onFrame: (now, dt, w, h) => {
      ctx.clearRect(0, 0, w, h);
      // Keep draw order for translucent overlaps. Only skip identical state
      // writes within this frame; resizing can reset the context between frames.
      let previousColor: string | undefined;
      for (const p of particles) {
        updateParticle(p, dt, now, w, h);
        if (p.color !== previousColor) {
          ctx.fillStyle = p.color;
          previousColor = p.color;
        }
        renderParticle(ctx, p);
      }
    },
  });

  return lifecycle.dispose;
}
