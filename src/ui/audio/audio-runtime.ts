import { assetUrl } from "../shared/assets";
import {
  defaultAudioPreferences,
  normalizeAudioPreferences,
  type AudioPreferences,
} from "../settings/preferences";
export type SoundCue =
  | "activate"
  | "physical"
  | "fire"
  | "ice"
  | "lightning"
  | "poison"
  | "nature"
  | "light"
  | "heal"
  | "block"
  | "absorb"
  | "deny"
  | "knockout"
  | "victory"
  | "defeat"
  | "recruit"
  | "talent";
export type MusicCue = "menu" | "combat" | "boss";
export interface MediaVoice {
  readonly paused?: boolean;
  volume: number;
  loop: boolean;
  preload: HTMLMediaElement["preload"];
  onended: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
  load(): void;
}
interface Voice {
  media: MediaVoice;
  gain: number;
  starting: boolean;
  released: boolean;
  timer?: ReturnType<typeof setInterval>;
}
interface MusicVoice extends Voice {
  cue: MusicCue;
  fade: number;
}
export function createAudioRuntime(
  report: (error: unknown) => void,
  makeMedia: (url: string) => MediaVoice = (url) => new Audio(url),
  quiet = false,
) {
  let preferences = defaultAudioPreferences;
  let disposed = false,
    unlocked = false,
    background = false;
  let requested: MusicCue = "menu";
  let music: MusicVoice | undefined, outgoing: MusicVoice | undefined;
  const effects = new Set<Voice>();
  const warm = new Set<Voice>();
  const voice = (url: string, gain = 1): Voice => ({
    media: makeMedia(url),
    gain,
    starting: false,
    released: false,
  });
  const audible = () =>
    !disposed &&
    !quiet &&
    unlocked &&
    preferences.enabled &&
    preferences.master > 0 &&
    !(background && preferences.muteInBackground);
  const release = (record: Voice) => {
    if (record.released) return;
    record.released = true;
    clearInterval(record.timer);
    record.timer = undefined;
    effects.delete(record);
    warm.delete(record);
    if (music === record) music = undefined;
    if (outgoing === record) outgoing = undefined;
    const { media } = record;
    media.onended = null;
    media.onerror = null;
    try {
      media.pause();
      media.removeAttribute("src");
      media.load();
    } catch {
      /* Revocation is best effort. */
    }
  };
  const volume = (kind: "music" | "effects") =>
    audible() ? ((preferences.master / 100) * preferences[kind]) / 100 : 0;
  const start = (record: Voice, failed: () => void) => {
    if (record.released || record.media.paused === false || record.starting) return;
    record.starting = true;
    const failure = (error: unknown) => {
      record.starting = false;
      if (!disposed && !record.released && (effects.has(record) || music === record)) {
        report(error);
        failed();
      }
    };
    try {
      void Promise.resolve(record.media.play()).then(() => (record.starting = false), failure);
    } catch (error) {
      failure(error);
    }
  };
  const fade = (record: MusicVoice, target: 0 | 1) => {
    clearInterval(record.timer);
    record.timer = setInterval(() => {
      record.fade = target === 1 ? Math.min(1, record.fade + 0.2) : Math.max(0, record.fade - 0.2);
      record.media.volume = volume("music") * record.fade;
      if (record.fade === target) {
        clearInterval(record.timer);
        record.timer = undefined;
        if (target === 0) release(record);
      }
    }, 30);
  };
  function updateMusic() {
    if (!audible() || preferences.music === 0) {
      music?.media.pause();
      return;
    }
    if (music?.cue === requested) {
      music.media.volume = volume("music") * music.fade;
      start(music, () => {});
      return;
    }
    if (music) {
      if (outgoing) release(outgoing);
      outgoing = music;
      music = undefined;
      // The outgoing track completes its fade even if creating the next track fails.
      fade(outgoing, 0);
    }
    try {
      const record: MusicVoice = {
        ...voice(assetUrl(`music.${requested === "combat" ? "fernwood" : requested}`)),
        cue: requested,
        fade: 0,
      };
      music = record;
      record.media.loop = true;
      record.media.preload = "auto";
      record.media.volume = 0;
      record.media.onerror = () => {
        if (!disposed && music === record) {
          report(new Error(`Music could not play: ${record.cue}`));
          release(record);
        }
      };
      fade(record, 1);
      start(record, () => release(record));
    } catch (error) {
      report(error);
    }
  }
  return {
    unlock() {
      if (disposed || quiet) return;
      if (unlocked) {
        updateMusic();
        return;
      }
      unlocked = true;
      // A bounded warm set; startup never waits for decoding or network work.
      for (const cue of ["physical", "block", "heal"] as const) {
        try {
          const record = voice(assetUrl(`sound.${cue}`));
          warm.add(record);
          record.media.preload = "auto";
          record.media.load();
        } catch (error) {
          report(error);
        }
      }
      updateMusic();
    },
    configure(value: AudioPreferences) {
      if (disposed) return;
      preferences = normalizeAudioPreferences(value);
      for (const record of effects) {
        record.media.volume = volume("effects") * record.gain;
        if (!audible()) release(record);
      }
      if (outgoing && !audible()) release(outgoing);
      if (music) music.media.volume = volume("music") * music.fade;
      updateMusic();
    },
    background(value: boolean) {
      if (disposed) return;
      background = value;
      this.configure(preferences);
    },
    music(cue: MusicCue) {
      if (disposed || cue === requested) return;
      requested = cue;
      updateMusic();
    },
    play(cue: SoundCue) {
      if (!audible() || preferences.effects === 0) return;
      try {
        if (effects.size >= 6) release(effects.values().next().value!);
        const record = voice(assetUrl(`sound.${cue}`), cue === "activate" ? 0.35 : 1);
        effects.add(record);
        const { media } = record;
        media.volume = volume("effects") * record.gain;
        media.loop = false;
        media.preload = "auto";
        media.onended = () => release(record);
        media.onerror = () => {
          if (effects.has(record)) {
            report(new Error(`Sound could not play: ${cue}`));
            release(record);
          }
        };
        start(record, () => release(record));
      } catch (error) {
        report(error);
      }
    },
    dispose() {
      disposed = true;
      for (const record of [...effects, ...warm, ...(music ? [music] : []), ...(outgoing ? [outgoing] : [])])
        release(record);
    },
  };
}
