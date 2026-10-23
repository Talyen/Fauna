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

interface BackgroundParticleConfig {
  particleCount: number;
  minSize: number;
  maxSize: number;
  minAlpha: number;
  maxAlpha: number;
  minSpeed: number;
  maxSpeed: number;
  colors: readonly string[];
  spawnBottomWeight?: number;
}

const EMBERS: BackgroundParticleConfig = {
  particleCount: 40,
  minSize: 1.5,
  maxSize: 3,
  minAlpha: 0.08,
  maxAlpha: 0.3,
  minSpeed: 3,
  maxSpeed: 8,
  colors: [],
};

const MAX_PARTICLE_BACKING_SCALE = 1.5;
const MAX_PARTICLE_BACKING_PIXELS = 3_000_000;
const MIN_PARTICLE_BACKING_SCALE = 0.25;

function spawnParticle(width: number, height: number, config: BackgroundParticleConfig): BackgroundParticle {
  const alpha = lerp(config.minAlpha, config.maxAlpha, Math.random());
  const rawColor = config.colors[Math.floor(Math.random() * config.colors.length)];
  const y = config.spawnBottomWeight
    ? height - Math.random() * height * (1 - config.spawnBottomWeight)
    : Math.random() * height;
  return {
    x: Math.random() * width,
    y,
    size: lerp(config.minSize, config.maxSize, Math.random()),
    alpha: 0,
    baseAlpha: alpha,
    speed: lerp(config.minSpeed, config.maxSpeed, Math.random()),
    swayAmplitude: 10 + Math.random() * 30,
    swaySpeed: 0.2 + Math.random() * 0.4,
    swayOffset: Math.random() * Math.PI * 2,
    color: rawColor ?? config.colors[0]!,
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

  const parent = canvas.parentElement;
  if (!parent) return () => {};

  let particles: BackgroundParticle[] = [];
  let logicalWidth = 0;
  let logicalHeight = 0;
  const config = EMBERS;
  const resolvedColors = colors;
  const mult = alphaMultiplier ?? 1;
  const patchedConfig = {
    ...config,
    colors: resolvedColors,
    minAlpha: config.minAlpha * mult,
    maxAlpha: config.maxAlpha * mult,
    particleCount: particleCount ?? config.particleCount,
  };

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
        particles = Array.from({ length: patchedConfig.particleCount }, () =>
          spawnParticle(w, h, patchedConfig),
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
