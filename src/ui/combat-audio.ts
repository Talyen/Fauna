import type { DamageType } from "../game/content";
import type { GameEvent } from "../game/types";
export type CombatCue = DamageType | "heal" | "block" | "absorb" | "mark";
/** Alchemy-inspired outcome selection: one strongest meaningful cue per resolved action. */
export function selectCombatCue(events: readonly GameEvent[]): CombatCue | undefined {
  let best: { cue: CombatCue; amount: number; priority: number } | undefined;
  for (const event of events) {
    const amount = Math.abs(event.amount ?? 0);
    if (amount === 0) continue;
    const cue =
      event.kind === "damage"
        ? (event.damageType ?? "physical")
        : event.kind === "heal"
          ? "heal"
          : event.kind === "block"
            ? event.amount! < 0
              ? "absorb"
              : "block"
            : event.kind === "mark"
              ? "mark"
              : undefined;
    if (!cue) continue;
    const priority = event.kind === "damage" ? 0 : event.kind === "heal" ? 1 : 2;
    if (!best || amount > best.amount || (amount === best.amount && priority < best.priority))
      best = { cue, amount, priority };
  }
  return best?.cue;
}
const VOICES: Record<CombatCue, { wave: OscillatorType; start: number; end: number; duration: number }> = {
  physical: { wave: "triangle", start: 170, end: 55, duration: 0.12 },
  fire: { wave: "sawtooth", start: 240, end: 75, duration: 0.14 },
  ice: { wave: "sine", start: 1100, end: 550, duration: 0.14 },
  lightning: { wave: "square", start: 850, end: 180, duration: 0.09 },
  poison: { wave: "triangle", start: 360, end: 140, duration: 0.16 },
  nature: { wave: "sine", start: 320, end: 110, duration: 0.14 },
  light: { wave: "sine", start: 780, end: 520, duration: 0.18 },
  heal: { wave: "sine", start: 440, end: 880, duration: 0.22 },
  block: { wave: "triangle", start: 260, end: 440, duration: 0.12 },
  absorb: { wave: "triangle", start: 170, end: 100, duration: 0.09 },
  mark: { wave: "sine", start: 620, end: 460, duration: 0.08 },
};
/** Original synthesized prototype cues; no Alchemy media assets are copied. */
export function createCombatAudio() {
  let context: AudioContext | undefined;
  let disposed = false,
    last = -Infinity;
  const voices = new Set<OscillatorNode>();
  const unlock = () => {
    if (disposed) return;
    try {
      context ??= new AudioContext();
      if (context.state === "suspended") void context.resume().catch(() => {});
    } catch {
      /* Audio availability never gates play. */
    }
  };
  return {
    unlock,
    play(cue: CombatCue) {
      if (disposed || !context || context.state !== "running" || performance.now() - last < 70) return;
      last = performance.now();
      try {
        if (voices.size >= 4) {
          const oldest = voices.values().next().value;
          oldest?.stop();
        }
        const voice = VOICES[cue],
          oscillator = context.createOscillator(),
          gain = context.createGain(),
          time = context.currentTime;
        oscillator.type = voice.wave;
        oscillator.frequency.setValueAtTime(voice.start, time);
        oscillator.frequency.exponentialRampToValueAtTime(voice.end, time + voice.duration);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.075, time + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + voice.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        voices.add(oscillator);
        oscillator.onended = () => {
          voices.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(time);
        oscillator.stop(time + voice.duration + 0.01);
      } catch {
        /* A suspended or unavailable device must not interrupt gameplay. */
      }
    },
    dispose() {
      disposed = true;
      voices.forEach((voice) => {
        try {
          voice.stop();
        } catch {
          /* Already ended. */
        }
      });
      voices.clear();
      if (context) void context.close().catch(() => {});
    },
  };
}
