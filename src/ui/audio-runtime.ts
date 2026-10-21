import { assetUrl } from "./assets";
import {
  defaultAudioPreferences,
  normalizeAudioPreferences,
  type AudioPreferences,
} from "./audio-preferences";
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
  preload: string;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play(): Promise<void>;
  pause(): void;
  removeAttribute(name: string): void;
  load(): void;
}
function browserMedia(url: string): MediaVoice {
  const media = new Audio(url);
  const voice: MediaVoice = {
    get paused() {
      return media.paused;
    },
    get volume() {
      return media.volume;
    },
    set volume(value) {
      media.volume = value;
    },
    get loop() {
      return media.loop;
    },
    set loop(value) {
      media.loop = value;
    },
    get preload() {
      return media.preload;
    },
    set preload(value) {
      media.preload = value as HTMLMediaElement["preload"];
    },
    onended: null,
    onerror: null,
    play: () => media.play(),
    pause: () => media.pause(),
    removeAttribute: (name) => media.removeAttribute(name),
    load: () => media.load(),
  };
  media.onended = () => voice.onended?.();
  media.onerror = () => voice.onerror?.();
  return voice;
}
export function createAudioRuntime(
  report: (error: unknown) => void,
  makeMedia: (url: string) => MediaVoice = browserMedia,
  quiet = false,
) {
  let preferences = defaultAudioPreferences;
  let disposed = false,
    unlocked = false,
    background = false;
  let requested: MusicCue = "menu";
  let music: { cue: MusicCue; media: MediaVoice; fade: number } | undefined;
  const voices = new Set<MediaVoice>();
  const voiceGain = new WeakMap<MediaVoice, number>();
  const fading = new Map<MediaVoice, ReturnType<typeof setInterval>>();
  const warm = new Set<MediaVoice>();
  const audible = () =>
    !disposed &&
    !quiet &&
    unlocked &&
    preferences.enabled &&
    preferences.master > 0 &&
    !(background && preferences.muteInBackground);
  const release = (media: MediaVoice) => {
    const timer = fading.get(media);
    if (timer) clearInterval(timer);
    fading.delete(media);
    voices.delete(media);
    warm.delete(media);
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
  const start = (media: MediaVoice, failed: () => void) => {
    if (media.paused === false) return;
    try {
      void Promise.resolve(media.play()).catch((error) => {
        if (!disposed && (voices.has(media) || music?.media === media)) {
          report(error);
          failed();
        }
      });
    } catch (error) {
      if (!disposed) {
        report(error);
        failed();
      }
    }
  };
  function updateMusic() {
    if (!audible() || preferences.music === 0) {
      music?.media.pause();
      return;
    }
    if (music?.cue === requested) {
      music.media.volume = volume("music") * music.fade;
      start(music.media, () => {});
      return;
    }
    if (music) {
      const old = music;
      // Each fade owns only its captured voice; completion cannot stop a successor.
      for (const media of fading.keys()) {
        if (media === old.media) {
          clearInterval(fading.get(media));
          fading.delete(media);
        } else release(media);
      }
      const timer = setInterval(() => {
        old.fade = Math.max(0, old.fade - 0.2);
        old.media.volume = volume("music") * old.fade;
        if (old.fade === 0) release(old.media);
      }, 30);
      fading.set(old.media, timer);
    }
    try {
      const record = {
        cue: requested,
        media: makeMedia(assetUrl(`music.${requested === "combat" ? "fernwood" : requested}`)),
        fade: 0,
      };
      music = record;
      record.media.loop = true;
      record.media.preload = "auto";
      record.media.volume = 0;
      record.media.onerror = () => {
        if (!disposed && music === record) {
          report(new Error(`Music could not play: ${record.cue}`));
          release(record.media);
          music = undefined;
        }
      };
      const timer = setInterval(() => {
        if (disposed || music !== record) {
          clearInterval(timer);
          return;
        }
        record.fade = Math.min(1, record.fade + 0.2);
        record.media.volume = volume("music") * record.fade;
        if (record.fade === 1) {
          clearInterval(timer);
          fading.delete(record.media);
        }
      }, 30);
      fading.set(record.media, timer);
      start(record.media, () => {
        if (music === record) {
          release(record.media);
          music = undefined;
        }
      });
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
          const media = makeMedia(assetUrl(`sound.${cue}`));
          media.preload = "auto";
          warm.add(media);
          media.load();
        } catch (error) {
          report(error);
        }
      }
      updateMusic();
    },
    configure(value: AudioPreferences) {
      if (disposed) return;
      preferences = normalizeAudioPreferences(value);
      for (const media of voices) {
        media.volume = volume("effects") * (voiceGain.get(media) ?? 1);
        if (!audible()) release(media);
      }
      for (const media of fading.keys())
        if (media !== music?.media) {
          if (!audible()) release(media);
        }
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
        if (voices.size >= 6) release(voices.values().next().value!);
        const media = makeMedia(assetUrl(`sound.${cue}`));
        const gain = cue === "activate" ? 0.35 : 1;
        voiceGain.set(media, gain);
        media.volume = volume("effects") * gain;
        media.loop = false;
        media.preload = "auto";
        voices.add(media);
        media.onended = () => release(media);
        media.onerror = () => {
          if (voices.has(media)) {
            report(new Error(`Sound could not play: ${cue}`));
            release(media);
          }
        };
        start(media, () => release(media));
      } catch (error) {
        report(error);
      }
    },
    dispose() {
      disposed = true;
      for (const media of [...voices, ...warm, ...fading.keys(), ...(music ? [music.media] : [])])
        release(media);
      music = undefined;
    },
  };
}
